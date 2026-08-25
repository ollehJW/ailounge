<template>
  <div class="administration-page asset-admin-page">
    <div class="admin-segments" role="tablist"><button v-for="item in tabs" :key="item.key" type="button" :class="{active:tab===item.key}" @click="tab=item.key"><span>{{ item.label }}</span><b>{{ item.count }}</b></button></div>
    <p v-if="error && !reviewTarget && !deleteTarget" class="form-error page-error">{{ error }}</p>
    <section class="asset-admin-panel">
      <header><div><span>{{ panelMeta.eyebrow }}</span><h2>{{ panelMeta.title }}</h2></div><div class="asset-admin-tools"><label v-if="tab==='operating'" class="search-box compact"><Search :size="16" /><input v-model="query" type="search" placeholder="자산 이름으로 검색" /></label><b>{{ visibleAssets.length }}건</b></div></header>
      <div class="asset-admin-list">
        <div v-if="loading" class="admin-empty"><LoaderCircle class="spin" :size="24" />AI 자산 목록을 불러오는 중입니다.</div>
        <div v-else-if="!visibleAssets.length" class="admin-empty"><ShieldCheck :size="26" /><strong>{{ query && tab==='operating' ? "검색 결과가 없습니다." : "표시할 AI 자산이 없습니다." }}</strong></div>
        <article v-for="asset in visibleAssets" v-else :key="asset.asset_id" :class="['asset-admin-row',tab,tab==='operating'&&!asset.is_active&&'inactive']">
          <span :class="['asset-admin-icon',tab]"><Bot :size="19" /></span>
          <div class="asset-admin-info"><div><h3>{{ asset.asset_name }}</h3><em :class="statusClass(asset)">{{ statusLabel(asset) }}</em></div><p>{{ asset.description }}</p><footer><span>{{ asset.business_area }}</span><span>{{ asset.maturity_level }}</span><span>{{ owner(asset) }}</span><time>{{ formatDate(asset.reviewed_at||asset.submitted_at||asset.created_at) }}</time></footer></div>
          <div v-if="tab==='operating'" class="asset-admin-metrics"><span><b>{{ asset.view_count||0 }}</b>조회</span><span><b>{{ asset.diffusion_attempt_count||0 }}</b>확산 시도</span><span><b>{{ asset.diffusion_completed_count||0 }}</b>확산 완료</span></div>
          <div class="asset-admin-actions">
            <button type="button" @click="viewDocument(asset)"><Eye :size="14" />View</button>
            <button v-if="tab==='requests'" type="button" class="primary" @click="openReview(asset)"><ShieldCheck :size="14" />심사</button>
            <template v-if="tab==='operating'"><label class="asset-toggle"><input type="checkbox" :checked="asset.is_active" :disabled="busyId===asset.asset_id" @change="toggleActivation(asset)" /><span></span><em>{{ asset.is_active?"활성":"비활성" }}</em></label><button type="button" class="danger" @click="deleteTarget=asset"><Trash2 :size="14" />삭제</button></template>
            <button v-if="tab==='rejected'" type="button" class="danger" @click="deleteTarget=asset"><Trash2 :size="14" />삭제</button>
          </div>
        </article>
      </div>
    </section>

    <BaseModal v-if="documentHtml!==null" title="AI 자산 등록서" size="large" @close="documentHtml=null"><div v-if="documentLoading" class="content-state modal-loading"><LoaderCircle class="spin" :size="28" />등록서를 구성하고 있습니다.</div><iframe v-else class="admin-document-frame" :srcdoc="documentHtml" sandbox="allow-scripts allow-popups" title="AI 자산 등록서"></iframe></BaseModal>
    <BaseModal v-if="reviewTarget" title="AI 자산 심사" size="small" @close="closeReview"><form class="admin-review-form" @submit.prevent="submitReview"><header><span>ASSET REVIEW</span><h2>자산 등록 심사</h2><p>{{ reviewTarget.asset_name }}</p></header><div class="admin-choice"><button type="button" :class="{active:reviewForm.status==='approved'}" @click="reviewForm.status='approved'">Approve</button><button type="button" class="reject" :class="{active:reviewForm.status==='rejected'}" @click="reviewForm.status='rejected'">Reject</button></div><label class="form-field"><span>심사 메시지</span><textarea v-model="reviewForm.comment" rows="6" placeholder="등록자에게 전달할 심사 의견을 작성하세요." required /></label><p v-if="error" class="form-error">{{ error }}</p><div class="form-buttons equal"><button type="button" class="secondary-button" @click="closeReview">취소</button><button class="primary-button" :disabled="saving||!reviewForm.status||!reviewForm.comment.trim()">{{ saving?"처리 중...":"심사 완료" }}</button></div></form></BaseModal>
    <BaseModal v-if="deleteTarget" title="AI 자산 삭제 확인" size="small" @close="deleteTarget=null"><div class="admin-confirm"><span><Trash2 :size="22" /></span><h2>AI 자산을 삭제할까요?</h2><strong>{{ deleteTarget.asset_name }}</strong><p>DB 정보와 Workspace 파일이 함께 삭제되며 복구할 수 없습니다.</p><p v-if="error" class="form-error">{{ error }}</p><div class="form-buttons equal"><button class="secondary-button" type="button" @click="deleteTarget=null">취소</button><button class="danger-button" type="button" :disabled="saving" @click="removeAsset">{{ saving?"삭제 중...":"삭제" }}</button></div></div></BaseModal>
  </div>
</template>

<script setup>
import { computed,onMounted,reactive,ref } from "vue";
import { Bot,Eye,LoaderCircle,Search,ShieldCheck,Trash2 } from "@/icons/lucide";
import BaseModal from "@/components/BaseModal.vue";
import { apiFetch,readApiError } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
const auth=useAuthStore();
const assets=ref([]),loading=ref(true),error=ref(""),tab=ref("requests"),query=ref(""),reviewTarget=ref(null),deleteTarget=ref(null),saving=ref(false),busyId=ref(""),documentHtml=ref(null),documentLoading=ref(false);
const reviewForm=reactive({status:"",comment:""});
const requests=computed(()=>assets.value.filter(a=>a.approval_status==="submitted")),operating=computed(()=>assets.value.filter(a=>a.approval_status==="approved")),rejected=computed(()=>assets.value.filter(a=>a.approval_status==="rejected"));
const tabs=computed(()=>[{key:"requests",label:"자산 등록 요청",count:requests.value.length},{key:"operating",label:"운영 자산",count:operating.value.length},{key:"rejected",label:"반려 자산",count:rejected.value.length}]);
const visibleAssets=computed(()=>{const list=tab.value==="requests"?requests.value:tab.value==="operating"?operating.value:rejected.value;const q=query.value.trim().toLowerCase();return tab.value==="operating"&&q?list.filter(a=>a.asset_name.toLowerCase().includes(q)):list;});
const panelMeta=computed(()=>({requests:{eyebrow:"REGISTRATION REQUESTS",title:"자산 등록 요청 리스트"},operating:{eyebrow:"APPROVED ASSETS",title:"실제 운영중인 자산 목록"},rejected:{eyebrow:"REJECTED ASSETS",title:"반려된 자산 목록"}}[tab.value]));
const formatDate=v=>String(v||"").slice(0,10),owner=a=>[a.owner_org,a.owner_name,a.owner_job_title].filter(Boolean).join(" · ");
const statusLabel=a=>a.approval_status==="submitted"?"심사 대기":a.approval_status==="rejected"?"반려":a.is_active?"활성":"비활성";
const statusClass=a=>a.approval_status==="submitted"?"submitted":a.approval_status==="rejected"?"rejected":a.is_active?"approved":"inactive";
async function load(){loading.value=true;error.value="";try{const r=await apiFetch("/api/admin/assets");if(!r.ok)throw await readApiError(r,"AI 자산 목록을 불러오지 못했습니다.");assets.value=await r.json();}catch(e){error.value=e.message;}finally{loading.value=false;}}
async function viewDocument(asset){documentHtml.value="";documentLoading.value=true;try{const r=await apiFetch(`/api/assets/${asset.asset_id}/registration-document`);if(!r.ok)throw await readApiError(r,"등록서를 불러오지 못했습니다.");documentHtml.value=await r.text();}catch(e){error.value=e.message;documentHtml.value=null;}finally{documentLoading.value=false;}}
function openReview(a){reviewTarget.value=a;reviewForm.status="";reviewForm.comment="";error.value="";}function closeReview(){if(saving.value)return;reviewTarget.value=null;error.value="";}
async function submitReview(){saving.value=true;try{const r=await apiFetch(`/api/admin/assets/${reviewTarget.value.asset_id}/status`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${auth.token}`},body:JSON.stringify({status:reviewForm.status,review_comment:reviewForm.comment.trim()})});if(!r.ok)throw await readApiError(r,"자산 심사를 완료하지 못했습니다.");const u=await r.json();assets.value=assets.value.map(a=>a.asset_id===u.asset_id?u:a);reviewTarget.value=null;reviewForm.status="";reviewForm.comment="";}catch(e){error.value=e.message;}finally{saving.value=false;}}
async function toggleActivation(a){busyId.value=a.asset_id;error.value="";try{const r=await apiFetch(`/api/admin/assets/${a.asset_id}/activation`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${auth.token}`},body:JSON.stringify({is_active:!a.is_active})});if(!r.ok)throw await readApiError(r,"활성 상태를 변경하지 못했습니다.");const u=await r.json();assets.value=assets.value.map(x=>x.asset_id===u.asset_id?u:x);}catch(e){error.value=e.message;}finally{busyId.value="";}}
async function removeAsset(){saving.value=true;error.value="";try{const r=await apiFetch(`/api/admin/assets/${deleteTarget.value.asset_id}`,{method:"DELETE",headers:{Authorization:`Bearer ${auth.token}`}});if(!r.ok)throw await readApiError(r,"자산을 삭제하지 못했습니다.");assets.value=assets.value.filter(a=>a.asset_id!==deleteTarget.value.asset_id);deleteTarget.value=null;}catch(e){error.value=e.message;}finally{saving.value=false;}}
onMounted(load);
</script>

