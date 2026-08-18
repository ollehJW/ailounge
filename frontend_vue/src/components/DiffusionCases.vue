<template>
  <section class="asset-diffusion-cases">
    <header class="asset-diffusion-case-toolbar"><div><span>DIFFUSION CASES</span><h3>확산 사례 목록 <small>· 총 {{ cases.length }}건</small></h3></div><button type="button" @click="openForm()"><Plus :size="14" />사례 등록</button></header>
    <div v-if="loading" class="asset-diffusion-case-state"><LoaderCircle class="spin" :size="16" />확산 사례를 불러오고 있습니다.</div>
    <div v-else-if="cases.length" class="asset-diffusion-case-list">
      <article v-for="item in cases" :key="item.diffusion_case_id" class="asset-diffusion-case-card">
        <header>
          <div><span>{{ item.writer_org }}</span><h4>{{ item.title }}</h4><small>{{ item.writer_name }}{{ item.writer_job_title ? ` ${item.writer_job_title}` : '' }} · {{ date(item.created_at) }}</small></div>
          <div class="asset-diffusion-case-card-tools">
            <em :class="`stage-${item.stage}`">{{ item.stage_label }}</em>
            <span v-if="item.can_edit"><button type="button" aria-label="확산 사례 수정" @click="openForm(item)"><Pencil :size="13" /></button><button class="delete" type="button" aria-label="확산 사례 삭제" @click="remove(item)"><Trash2 :size="13" /></button></span>
          </div>
        </header>
        <div class="asset-diffusion-case-fields"><section><b>적용 업무</b><p>{{ item.applied_work }}</p></section><section><b>수정·활용 방식</b><p>{{ item.customization }}</p></section><section><b>적용 효과</b><p>{{ item.effect }}</p></section></div>
        <footer v-if="item.git_url"><GitBranch :size="14" /><code>{{ item.git_url }}</code><button type="button" @click="copy(item.git_url)">Copy</button></footer>
      </article>
    </div>
    <div v-else class="asset-diffusion-case-empty"><GitBranch :size="25" /><b>아직 등록된 확산 사례가 없습니다</b><p>이 자산을 업무에 적용한 경험을 첫 사례로 공유해보세요.</p></div>
    <BaseModal v-if="formOpen" :title="editingId?'확산 사례 수정':'확산 사례 등록'" size="medium" @close="formOpen=false"><form class="case-form" @submit.prevent="save"><header><span>DIFFUSION CASE</span><h2>{{ editingId?'확산 사례 수정':'확산 사례 등록' }}</h2><p><b>{{ asset.asset_name }}</b>을 실제 업무에 적용한 경험을 공유합니다.</p></header><label class="form-field"><span>사례 제목 <b>*</b></span><input v-model="form.title" placeholder="자산을 적용한 업무와 핵심 결과가 드러나도록 작성하세요." /></label><label class="form-field"><span>확산 단계 <b>*</b></span><select v-model="form.stage"><option value="">선택</option><option value="poc">PoC</option><option value="pilot">Pilot</option><option value="production">운영</option></select></label><label class="form-field"><span>적용 업무 <b>*</b></span><textarea v-model="form.applied_work" rows="3" placeholder="어떤 업무·공정·프로세스에 적용했는지 작성하세요."></textarea></label><label class="form-field"><span>수정·활용 방식 <b>*</b></span><textarea v-model="form.customization" rows="3" placeholder="업무 환경에 맞게 어떻게 수정하고 활용했는지 작성하세요."></textarea></label><label class="form-field"><span>적용 효과 <b>*</b></span><textarea v-model="form.effect" rows="3" placeholder="적용 후 확인된 정량적·정성적 효과를 작성하세요."></textarea></label><label class="form-field"><span>공유 코드 Git URL <small>선택</small></span><input v-model="form.git_url" type="url" placeholder="https://git.hyundai-wia.com/..." /></label><p v-if="error" class="form-error">{{ error }}</p><div class="form-buttons equal"><button type="button" class="secondary-button" @click="formOpen=false">취소</button><button class="primary-button" :disabled="saving">{{ saving?'저장 중...':editingId?'수정':'등록' }}</button></div></form></BaseModal>
  </section>
</template>
<script setup>
import { onMounted, reactive, ref } from "vue";import { GitBranch,LoaderCircle,Pencil,Plus,Trash2 } from "lucide-vue-next";import BaseModal from "./BaseModal.vue";import { apiFetch,readApiError } from "../api/client";
const props=defineProps({asset:{type:Object,required:true}}),emit=defineEmits(["count-change"]);const cases=ref([]),loading=ref(true),formOpen=ref(false),editingId=ref(""),saving=ref(false),error=ref("");const form=reactive({title:"",stage:"",applied_work:"",customization:"",effect:"",git_url:""});
async function call(path,options={},fallback){const response=await apiFetch(path,options);if(!response.ok)throw await readApiError(response,fallback);return response.status===204?null:response.json();}async function load(){loading.value=true;try{cases.value=await call(`/api/assets/catalog/${props.asset.asset_id}/diffusion-cases`,{},"사례를 불러오지 못했습니다.");}finally{loading.value=false;}}
function openForm(item){editingId.value=item?.diffusion_case_id||"";Object.assign(form,{title:item?.title||"",stage:item?.stage||"",applied_work:item?.applied_work||"",customization:item?.customization||"",effect:item?.effect||"",git_url:item?.git_url||""});error.value="";formOpen.value=true;}
const date=value=>String(value||"").slice(0,10);const copy=value=>navigator.clipboard.writeText(value);
async function save(){if(!form.title||!form.stage||!form.applied_work||!form.customization||!form.effect){error.value="필수 항목을 모두 작성하세요.";return;}saving.value=true;try{const path=`/api/assets/catalog/${props.asset.asset_id}/diffusion-cases${editingId.value?`/${editingId.value}`:""}`;const result=await call(path,{method:editingId.value?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)},"사례를 저장하지 못했습니다.");emit("count-change",result.diffusion_completed_count);formOpen.value=false;await load();}catch(e){error.value=e.message;}finally{saving.value=false;}}
async function remove(item){if(!confirm("이 확산 사례를 삭제할까요?"))return;try{const result=await call(`/api/assets/catalog/${props.asset.asset_id}/diffusion-cases/${item.diffusion_case_id}`,{method:"DELETE"},"사례를 삭제하지 못했습니다.");emit("count-change",result.diffusion_completed_count);await load();}catch(e){error.value=e.message;}}onMounted(load);
</script>
