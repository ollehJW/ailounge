<template>
  <section class="asset-qa">
    <header class="asset-qa-head">
      <span>ASSET Q&amp;A</span>
      <h3>Q&amp;A · 적용 경험 공유</h3>
      <p>자산 담당자와 사용자들이 적용 방법, 데이터 구조, 성능 기준과 운영 경험을 나누는 공간입니다.</p>
    </header>
    <form class="asset-qa-compose" @submit.prevent="createQuestion">
      <div class="asset-qa-avatar"><UserRound :size="18" /></div>
      <div>
        <textarea v-model="question" placeholder="이 자산의 적용 방법, 데이터 구조, 성능 기준에 대해 질문해 보세요."></textarea>
        <footer><span>{{ auth.user?.org_name }} · {{ auth.user?.displayed_name }}</span><button type="submit" :disabled="!question.trim()"><MessageCircle :size="14" />질문 등록</button></footer>
      </div>
    </form>
    <div v-if="error" class="asset-qa-error">{{ error }}</div>
    <div v-if="loading" class="asset-qa-state"><LoaderCircle class="spin" />Q&amp;A를 불러오고 있습니다.</div>
    <div v-else-if="threads.length" class="asset-qa-list">
      <article v-for="thread in threads" :key="thread.qa_post_id" class="asset-qa-item">
        <div class="asset-qa-avatar"><UserRound :size="17" /></div>
        <div class="asset-qa-content">
          <header>
            <div><b>{{ thread.writer_name }}</b><em v-if="thread.writer_job_title">{{ thread.writer_job_title }}</em></div>
            <div class="asset-qa-question-meta"><span>{{ date(thread.created_at) }} · {{ thread.topic }}</span><div v-if="thread.can_edit" class="asset-qa-question-tools"><button type="button" aria-label="질문 수정" @click="startEdit(thread)"><Pencil :size="12" /></button><button class="delete" type="button" aria-label="질문 삭제" @click="remove(thread.qa_post_id)"><Trash2 :size="12" /></button></div></div>
          </header>
          <form v-if="editingId===thread.qa_post_id" class="asset-qa-question-edit" @submit.prevent="saveEdit(thread.qa_post_id)"><textarea v-model="editText" rows="3" autofocus></textarea><div><button type="button" @click="cancelEdit">취소</button><button type="submit" :disabled="!editText.trim()">수정 완료</button></div></form>
          <p v-else>{{ thread.content }}</p>
          <div v-for="reply in thread.replies" :key="reply.qa_post_id" class="asset-qa-reply">
            <header><b>{{ reply.writer_name }}</b><em v-if="reply.writer_job_title">{{ reply.writer_job_title }}</em><span v-if="reply.is_owner">자산 담당자</span><small>{{ date(reply.created_at) }}</small><div v-if="reply.can_edit" class="asset-qa-reply-tools"><button type="button" aria-label="답글 수정" @click="startEdit(reply)"><Pencil :size="12" /></button><button class="delete" type="button" aria-label="답글 삭제" @click="remove(reply.qa_post_id)"><Trash2 :size="12" /></button></div></header>
            <form v-if="editingId===reply.qa_post_id" class="asset-qa-reply-edit" @submit.prevent="saveEdit(reply.qa_post_id)"><textarea v-model="editText" rows="2" autofocus></textarea><div><button type="button" @click="cancelEdit">취소</button><button type="submit" :disabled="!editText.trim()">수정 완료</button></div></form>
            <p v-else>{{ reply.content }}</p>
          </div>
          <div class="asset-qa-actions"><button :class="{active:thread.helpful_by_me}" type="button" @click="toggleHelpful(thread)"><ThumbsUp :size="13" :fill="thread.helpful_by_me?'currentColor':'none'" />도움돼요 {{ thread.helpful_count }}</button><button type="button" @click="replyTarget=replyTarget===thread.qa_post_id?'':thread.qa_post_id">답글</button></div>
          <form v-if="replyTarget===thread.qa_post_id" class="asset-qa-reply-compose" @submit.prevent="createReply(thread.qa_post_id)"><textarea v-model="replyText" rows="2" autofocus placeholder="답글을 작성하세요."></textarea><div><button type="button" @click="replyTarget=''">취소</button><button type="submit" :disabled="!replyText.trim()">답글 등록</button></div></form>
        </div>
      </article>
    </div>
    <div v-else class="asset-qa-state empty"><MessageCircle :size="23" /><b>아직 등록된 질문이 없습니다</b><span>이 자산에 대해 궁금한 내용을 첫 질문으로 남겨보세요.</span></div>
  </section>
</template>
<script setup>
import { onMounted,ref } from "vue";import { LoaderCircle, MessageCircle, Pencil, ThumbsUp, Trash2, UserRound } from "lucide-vue-next";import { apiFetch,readApiError } from "../api/client";import { useAuthStore } from "../stores/auth";
const props=defineProps({assetId:{type:String,required:true}});const auth=useAuthStore();const threads=ref([]),loading=ref(true),error=ref(""),topic=ref("적용 문의"),question=ref(""),replyTarget=ref(""),replyText=ref(""),editingId=ref(""),editText=ref("");const date=value=>String(value||"").slice(0,10);
async function call(path,options={},fallback){const response=await apiFetch(path,options);if(!response.ok)throw await readApiError(response,fallback);return response.status===204?null:response.json();}async function load(){loading.value=true;error.value="";try{threads.value=await call(`/api/assets/catalog/${props.assetId}/qa`,{},"Q&A를 불러오지 못했습니다.");}catch(e){error.value=e.message;}finally{loading.value=false;}}
async function createQuestion(){try{await call(`/api/assets/catalog/${props.assetId}/qa/questions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${auth.token}`},body:JSON.stringify({topic:topic.value,content:question.value.trim()})},"질문을 등록하지 못했습니다.");question.value="";await load();}catch(e){error.value=e.message;}}
async function createReply(id){try{await call(`/api/assets/catalog/${props.assetId}/qa/questions/${id}/replies`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${auth.token}`},body:JSON.stringify({content:replyText.value.trim()})},"답글을 등록하지 못했습니다.");replyText.value="";replyTarget.value="";await load();}catch(e){error.value=e.message;}}
const startEdit=item=>{editingId.value=item.qa_post_id;editText.value=item.content;};const cancelEdit=()=>{editingId.value="";editText.value="";};async function saveEdit(id){try{await call(`/api/assets/catalog/${props.assetId}/qa/posts/${id}`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${auth.token}`},body:JSON.stringify({content:editText.value.trim()})},"내용을 수정하지 못했습니다.");cancelEdit();await load();}catch(e){error.value=e.message;}}
async function remove(id){if(!confirm("작성한 내용을 삭제할까요? 답글이 있는 질문은 답글도 함께 삭제됩니다."))return;try{await call(`/api/assets/catalog/${props.assetId}/qa/posts/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${auth.token}`}},"내용을 삭제하지 못했습니다.");await load();}catch(e){error.value=e.message;}}
async function toggleHelpful(thread){try{const method=thread.helpful_by_me?"DELETE":"POST";const result=await call(`/api/assets/catalog/${props.assetId}/qa/questions/${thread.qa_post_id}/helpful`,{method,headers:{Authorization:`Bearer ${auth.token}`}},"도움돼요를 반영하지 못했습니다.");thread.helpful_count=result.helpful_count;thread.helpful_by_me=result.helpful_by_me;}catch(e){error.value=e.message;}}onMounted(load);
</script>
