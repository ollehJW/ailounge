<template>
  <div class="administration-page idea-review-admin">
    <p v-if="error && !reviewTarget" class="form-error page-error">{{ error }}</p>
    <div class="admin-review-grid">
      <section v-for="column in columns" :key="column.key" class="admin-review-column">
        <header><div><span>IDEA REVIEW</span><h2>{{ column.title }}</h2></div><b>{{ column.items.length }}건</b></header>
        <div class="admin-review-list">
          <div v-if="loading" class="admin-empty"><LoaderCircle class="spin" :size="24" />아이디어를 불러오는 중입니다.</div>
          <div v-else-if="!column.items.length" class="admin-empty"><Inbox :size="25" /><strong>표시할 아이디어가 없습니다.</strong></div>
          <button v-for="idea in column.items" v-else :key="idea.idea_id" type="button" :class="['admin-review-card', column.key === 'completed' && 'completed', statusClass(idea.status)]" @click="selectedIdea = idea">
            <span v-if="column.key === 'completed'" class="admin-result-ribbon">{{ idea.status }}</span>
            <h3>{{ idea.title }}</h3>
            <div><span><UserRound :size="13" />{{ author(idea) }}</span><time>{{ formatDate(idea.created_at) }}</time></div>
          </button>
        </div>
      </section>
    </div>

    <BaseModal v-if="selectedIdea" title="AI 아이디어 제안서" size="idea" @close="selectedIdea = null">
      <article class="idea-proposal">
        <header class="idea-proposal-head">
          <div class="idea-proposal-title"><span>AI IDEA PROPOSAL</span><h2>{{ selectedIdea.title }}</h2><p>{{ author(selectedIdea) }}</p></div>
          <div class="idea-proposal-meta"><div><span>상태</span><strong :class="['idea-proposal-status', statusClass(selectedIdea.status)]">{{ selectedIdea.status }}</strong></div><div><span>제출일</span><strong>{{ formatDate(selectedIdea.created_at) }}</strong></div></div>
        </header>
        <section v-if="selectedIdea.status === '접수완료'" class="admin-review-callout"><div><strong>심사가 필요한 아이디어입니다.</strong><span>제안 내용을 확인한 후 심사 의견을 작성하세요.</span></div><button class="primary-button" type="button" @click="openReview(selectedIdea)"><ClipboardCheck :size="16" />심사</button></section>
        <section v-else-if="selectedIdea.review_comment" :class="['idea-proposal-review', statusClass(selectedIdea.status)]"><div><span>심사 완료</span><strong>{{ selectedIdea.status }}</strong></div><div class="idea-proposal-review-message">{{ selectedIdea.review_comment }}</div><time>{{ formatDate(selectedIdea.reviewed_at) }}</time></section>
        <div class="idea-proposal-body">
          <section><span>01</span><div><h3>문제 정의</h3><p>{{ selectedIdea.problem_definition }}</p></div></section>
          <section><span>02</span><div><h3>제안 내용</h3><p>{{ selectedIdea.proposal }}</p></div></section>
          <section class="highlight"><span>03</span><div><h3>예상 효과</h3><p>{{ selectedIdea.effect }}</p></div></section>
          <section><span>04</span><div><h3>참고자료</h3><div v-if="selectedIdea.attachments?.length" class="idea-proposal-files"><button v-for="file in selectedIdea.attachments" :key="file.attachment_id" type="button" @click="download(file)">{{ file.original_name }}</button></div><p v-else>첨부된 참고자료가 없습니다.</p></div></section>
        </div>
      </article>
    </BaseModal>

    <BaseModal v-if="reviewTarget" title="심사 의견 작성" size="small" @close="closeReview">
      <form class="admin-review-form" @submit.prevent="submitReview">
        <header><span>IDEA REVIEW</span><h2>심사 의견 작성</h2><p>{{ reviewTarget.title }}</p></header>
        <div class="admin-choice"><button type="button" :class="{ active: reviewForm.status === '선정' }" @click="reviewForm.status = '선정'">선정</button><button type="button" class="reject" :class="{ active: reviewForm.status === '미선정' }" @click="reviewForm.status = '미선정'">미선정</button></div>
        <label class="form-field"><span>심사 의견</span><textarea v-model="reviewForm.comment" rows="6" placeholder="심사 결과의 근거와 후속 안내를 작성하세요." required /></label>
        <p v-if="error" class="form-error">{{ error }}</p>
        <div class="form-buttons equal"><button type="button" class="secondary-button" @click="closeReview">취소</button><button class="primary-button" :disabled="saving || !reviewForm.status || !reviewForm.comment.trim()">{{ saving ? "처리 중..." : "보내기" }}</button></div>
      </form>
    </BaseModal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { ClipboardCheck, Inbox, LoaderCircle, UserRound } from "lucide-vue-next";
import BaseModal from "../components/BaseModal.vue";
import { apiFetch, readApiError } from "../api/client";
import { useAuthStore } from "../stores/auth";

const auth=useAuthStore();
const ideas=ref([]),loading=ref(true),error=ref(""),selectedIdea=ref(null),reviewTarget=ref(null),saving=ref(false);
const reviewForm=reactive({status:"",comment:""});
const pending=computed(()=>ideas.value.filter(i=>i.status==="접수완료"));
const completed=computed(()=>ideas.value.filter(i=>["선정","미선정"].includes(i.status)));
const columns=computed(()=>[{key:"pending",title:"심사 필요",items:pending.value},{key:"completed",title:"심사 완료",items:completed.value}]);
const statusClass=s=>({선정:"selected",미선정:"rejected",접수완료:"received"}[s]||"received");
const formatDate=v=>String(v||"").slice(0,10);
const author=i=>[i.author_org,i.author_name,i.author_job_title].filter(Boolean).join(" · ")||"작성자 정보 없음";
async function load(){loading.value=true;error.value="";try{const r=await apiFetch("/api/admin/ideas");if(!r.ok)throw await readApiError(r,"심사 아이디어 목록을 불러오지 못했습니다.");ideas.value=await r.json();}catch(e){error.value=e.message;}finally{loading.value=false;}}
function openReview(idea){reviewTarget.value=idea;reviewForm.status=["선정","미선정"].includes(idea.status)?idea.status:"";reviewForm.comment=idea.review_comment||"";error.value="";}
function closeReview(){if(saving.value)return;reviewTarget.value=null;reviewForm.status="";reviewForm.comment="";error.value="";}
async function submitReview(){saving.value=true;error.value="";try{const r=await apiFetch(`/api/admin/ideas/${reviewTarget.value.idea_id}/status`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${auth.token}`},body:JSON.stringify({status:reviewForm.status,review_comment:reviewForm.comment.trim()})});if(!r.ok)throw await readApiError(r,"아이디어 심사를 완료하지 못했습니다.");const updated=await r.json();ideas.value=ideas.value.map(i=>i.idea_id===updated.idea_id?updated:i);if(selectedIdea.value?.idea_id===updated.idea_id)selectedIdea.value=updated;reviewTarget.value=null;reviewForm.status="";reviewForm.comment="";}catch(e){error.value=e.message;}finally{saving.value=false;}}
async function download(file){try{const r=await apiFetch(file.url);if(!r.ok)throw await readApiError(r,"첨부파일을 내려받지 못했습니다.");const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=file.original_name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}catch(e){error.value=e.message;}}
onMounted(load);
</script>
