<template>
  <div class="community-page ideas-page">
      <section class="idea-process">
        <div class="idea-process-intro"><span>PROCESS GUIDE</span><h2>아이디어를 보내면 이렇게 진행됩니다</h2><p>작성한 제안은 DX추진랩에 전달되며, 업무 영향도와 AI 적용 가능성 검토 후 심사평과 함께 결과가 업데이트됩니다.</p></div>
        <div class="idea-process-steps">
          <article><b>01</b><strong>접수완료</strong><span>제안 내용과 첨부자료가 DX추진랩 검토 목록에 등록됩니다.</span></article>
          <article class="review"><b>02</b><strong>심사</strong><span>DX추진랩이 제안 내용을 검토하고, 결과와 함께 심사평을 제공합니다.</span></article>
          <article class="selected"><b>03A</b><strong>선정</strong><span>PoC 또는 과제화를 위해 담당자와 후속 논의를 진행합니다.</span></article>
          <article class="rejected"><b>03B</b><strong>미선정</strong><span>현재 추진은 어렵지만, 심사평을 바탕으로 보완 방향을 확인할 수 있습니다.</span></article>
        </div>
      </section>

      <p v-if="error" class="form-error page-error">{{ error }}</p>
      <div class="idea-layout">
        <section class="idea-panel idea-list-panel"><header><div><span>MY IDEAS</span><h2>내가 보낸 아이디어</h2></div><b>{{ ideas.length }}건</b></header>
          <div v-if="loading" class="content-state"><LoaderCircle class="spin" :size="28" /><span>아이디어를 불러오는 중입니다.</span></div>
          <div v-else-if="ideas.length" class="idea-list"><article v-for="idea in ideas" :key="idea.idea_id" class="idea-card" @click="selectedIdea = idea"><div><time>{{ formatDate(idea.created_at) }}</time><h3>{{ idea.title }}</h3></div><span :class="['status-chip', statusClass(idea.status)]">{{ idea.status }}</span><button type="button" class="icon-button danger" :aria-label="`${idea.title} 삭제`" @click.stop="deleteTarget = idea"><Trash2 :size="15" /></button></article></div>
          <div v-else class="content-state empty"><Lightbulb :size="34" /><strong>아직 보낸 아이디어가 없습니다.</strong><span>업무에서 반복되는 문제를 제안해 주세요.</span></div>
        </section>

        <form class="idea-panel idea-form" @submit.prevent="submitIdea"><header><div><span>SUBMIT</span><h2>아이디어 작성</h2></div><div class="idea-form-progress"><div><span><b>{{ completedFields }}</b>/4</span><small>필수 항목 작성</small></div><i><b :style="{ width: `${completedFields * 25}%` }"></b></i></div></header>
          <label class="form-field numbered"><span><em>01</em>제목 <b>*</b><CheckCircle2 v-if="form.title.trim()" :size="16" /></span><input v-model="form.title" placeholder="제안하려는 아이디어가 드러나는 제목을 작성해 주세요." required /></label>
          <label class="form-field numbered"><span><em>02</em>문제 정의 <b>*</b><CheckCircle2 v-if="form.problem_definition.trim()" :size="16" /></span><textarea v-model="form.problem_definition" rows="4" placeholder="현재 업무에서 어떤 문제가 반복되는지 작성해 주세요." required></textarea></label>
          <label class="form-field numbered"><span><em>03</em>제안 내용 <b>*</b><CheckCircle2 v-if="form.proposal.trim()" :size="16" /></span><textarea v-model="form.proposal" rows="5" placeholder="AI를 어떻게 적용하면 좋을지 구체적으로 작성해 주세요." required></textarea></label>
          <label class="form-field numbered"><span><em>04</em>예상 효과 <b>*</b><CheckCircle2 v-if="form.effect.trim()" :size="16" /></span><textarea v-model="form.effect" rows="3" placeholder="시간 절감, 오류 감소, 표준화 등 기대 효과를 작성해 주세요." required></textarea></label>
          <div class="form-field numbered"><span><em>05</em>참고자료 <small>선택</small><CheckCircle2 v-if="form.attachments.length" :size="16" /></span><input ref="fileInput" class="hidden-input" type="file" multiple @change="addFiles" /><button type="button" class="file-picker" @click="fileInput?.click()"><Paperclip :size="18" /><span><strong>파일 선택</strong><small>문서, 이미지, 표 파일을 여러 개 첨부할 수 있습니다.</small></span></button><div v-if="form.attachments.length" class="file-list"><span v-for="(file,index) in form.attachments" :key="`${file.name}-${file.size}`"><FileText :size="15" /><b>{{ file.name }}</b><small>{{ fileSize(file.size) }}</small><button type="button" @click="form.attachments.splice(index,1)"><X :size="14" /></button></span></div></div>
          <div class="form-buttons"><button type="button" class="secondary-button" @click="resetForm">초기화</button><button class="primary-button" :disabled="submitting"><Send :size="17" />{{ submitting ? "접수 중..." : "아이디어 보내기" }}</button></div>
        </form>
      </div>

      <BaseModal v-if="selectedIdea" title="AI 아이디어 제안서" size="idea" @close="selectedIdea = null">
        <article class="idea-proposal">
          <header class="idea-proposal-head">
            <div class="idea-proposal-title"><span>AI IDEA PROPOSAL</span><h2>{{ selectedIdea.title }}</h2><p>DX추진랩 검토 대상 제안서</p></div>
            <div class="idea-proposal-meta">
              <div><span>상태</span><strong :class="['idea-proposal-status', statusClass(selectedIdea.status)]">{{ selectedIdea.status }}</strong></div>
              <div><span>제출일</span><strong>{{ formatDate(selectedIdea.created_at) }}</strong></div>
            </div>
          </header>

          <section v-if="selectedIdea.status !== '접수완료' && selectedIdea.review_comment" :class="['idea-proposal-review', statusClass(selectedIdea.status)]">
            <div><span>심사 완료</span><strong>{{ selectedIdea.status }}</strong></div>
            <div class="idea-proposal-review-message">{{ selectedIdea.review_comment }}</div>
            <time v-if="selectedIdea.reviewed_at">{{ formatDate(selectedIdea.reviewed_at) }}</time>
          </section>

          <div class="idea-proposal-body">
            <section><span>01</span><div><h3>문제 정의</h3><p>{{ selectedIdea.problem_definition }}</p></div></section>
            <section><span>02</span><div><h3>제안 내용</h3><p>{{ selectedIdea.proposal }}</p></div></section>
            <section class="highlight"><span>03</span><div><h3>예상 효과</h3><p>{{ selectedIdea.effect }}</p></div></section>
            <section><span>04</span><div><h3>참고자료</h3><div v-if="selectedIdea.attachments?.length" class="idea-proposal-files"><button v-for="attachment in selectedIdea.attachments" :key="attachment.attachment_id" type="button" @click="downloadAttachment(attachment)">{{ attachment.original_name }}</button></div><p v-else>첨부된 참고자료가 없습니다.</p></div></section>
          </div>
        </article>
      </BaseModal>
      <BaseModal v-if="successOpen" title="아이디어 접수 완료" size="small" @close="successOpen = false"><div class="confirm-content"><span class="confirm-icon success"><CheckCircle2 :size="25" /></span><h2>접수 완료</h2><p>DX추진랩에 아이디어가 접수되었습니다.</p><button type="button" class="primary-button" @click="successOpen = false">확인</button></div></BaseModal>
      <BaseModal v-if="deleteTarget" title="아이디어 삭제 확인" size="small" @close="deleteTarget = null"><div class="confirm-content"><span class="confirm-icon delete"><Trash2 :size="24" /></span><h2>아이디어를 삭제할까요?</h2><p><strong>{{ deleteTarget.title }}</strong> 제안은 삭제 후 되돌릴 수 없습니다.</p><div class="form-buttons equal"><button type="button" class="secondary-button" @click="deleteTarget = null">아니오</button><button type="button" class="danger-button" :disabled="deleting" @click="deleteIdea">예</button></div></div></BaseModal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { CheckCircle2, FileText, Lightbulb, LoaderCircle, Paperclip, Send, Trash2, X } from "lucide-vue-next";
import BaseModal from "@/components/BaseModal.vue"; import { apiFetch, readApiError } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
const auth=useAuthStore();
const ideas=ref([]);const loading=ref(true);const error=ref("");const submitting=ref(false);const deleting=ref(false);const selectedIdea=ref(null);const deleteTarget=ref(null);const successOpen=ref(false);const fileInput=ref(null);
const form=reactive({title:"",problem_definition:"",proposal:"",effect:"",attachments:[]});const completedFields=computed(()=>[form.title,form.problem_definition,form.proposal,form.effect].filter((value)=>value.trim()).length);
const formatDate=(value)=>String(value||"").slice(0,10);const fileSize=(value)=>`${(Number(value||0)/1024/1024).toFixed(2)} MB`;const statusClass=(status)=>({접수완료:"received",선정:"selected",미선정:"rejected"}[status]||"received");
const loadIdeas=async()=>{loading.value=true;error.value="";try{const response=await apiFetch("/api/ideas");if(!response.ok)throw await readApiError(response,"아이디어 목록을 불러오지 못했습니다.");ideas.value=await response.json();}catch(loadError){error.value=loadError.message;}finally{loading.value=false;}};
const addFiles=(event)=>{const incoming=Array.from(event.target.files||[]);const keys=new Set(form.attachments.map((file)=>`${file.name}-${file.size}-${file.lastModified}`));incoming.forEach((file)=>{const key=`${file.name}-${file.size}-${file.lastModified}`;if(!keys.has(key)){keys.add(key);form.attachments.push(file);}});event.target.value="";};
const resetForm=()=>{form.title="";form.problem_definition="";form.proposal="";form.effect="";form.attachments=[];};
const submitIdea=async()=>{submitting.value=true;error.value="";const body=new FormData();body.append("title",form.title.trim());body.append("problem_definition",form.problem_definition.trim());body.append("proposal",form.proposal.trim());body.append("effect",form.effect.trim());form.attachments.forEach((file)=>body.append("attachments",file));try{const response=await apiFetch("/api/ideas",{method:"POST",headers:{Authorization:`Bearer ${auth.token}`},body});if(!response.ok)throw await readApiError(response,"아이디어를 접수하지 못했습니다.");const created=await response.json();ideas.value.unshift(created);resetForm();successOpen.value=true;}catch(saveError){error.value=saveError.message;}finally{submitting.value=false;}};
const deleteIdea=async()=>{if(!deleteTarget.value)return;deleting.value=true;error.value="";try{const response=await apiFetch(`/api/ideas/${deleteTarget.value.idea_id}`,{method:"DELETE",headers:{Authorization:`Bearer ${auth.token}`}});if(!response.ok)throw await readApiError(response,"아이디어를 삭제하지 못했습니다.");ideas.value=ideas.value.filter((idea)=>idea.idea_id!==deleteTarget.value.idea_id);if(selectedIdea.value?.idea_id===deleteTarget.value.idea_id)selectedIdea.value=null;deleteTarget.value=null;}catch(deleteError){error.value=deleteError.message;}finally{deleting.value=false;}};
const downloadAttachment=async(attachment)=>{try{const response=await apiFetch(attachment.url);if(!response.ok)throw await readApiError(response,"첨부파일을 내려받지 못했습니다.");const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=attachment.original_name;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);}catch(downloadError){error.value=downloadError.message;}};
onMounted(loadIdeas);
</script>

