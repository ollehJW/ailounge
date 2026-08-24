<template>
  <div class="administration-page news-admin-vue">
    <div class="admin-page-tabs"><button type="button" :class="{active:tab==='write'}" @click="tab='write'">작성</button><button type="button" :class="{active:tab==='manage'}" @click="tab='manage'">관리</button></div>
    <p v-if="error" class="form-error page-error">{{ error }}</p>
    <form v-if="tab==='write'" class="admin-news-editor" @submit.prevent="publish">
      <section class="admin-surface">
        <header class="admin-surface-head"><span>{{ editingId?"EDIT":"WRITE" }}</span><h2>{{ editingId?"게시글 수정":"게시글 작성" }}</h2></header>
        <div class="news-category-selector"><span>콘텐츠 유형</span><div><button v-for="item in categories" :key="item.value" type="button" :class="{active:form.category===item.value}" @click="changeCategory(item.value)">{{ item.label }}</button></div></div>
        <label v-if="form.category==='bp'" class="form-field"><span>조직</span><input v-model="form.org_name" placeholder="BP 사례를 적용한 조직명을 입력하세요." required /></label>
        <label v-if="form.category==='external'" class="form-field"><span>외부 원문 URL <small>선택</small></span><input v-model="form.source_url" type="url" placeholder="https://..." /></label>
        <label class="form-field"><span>제목</span><input v-model="form.title" placeholder="뉴스 제목을 입력하세요." required /></label>
        <label class="form-field"><span>커버 이미지 <small v-if="form.category==='bp'">선택</small></span><input ref="coverInput" type="file" accept="image/*" @change="form.cover=$event.target.files?.[0]||null" /></label>
        <label class="form-field"><span>{{ form.category==='bp'?"내용":"소스 자료" }}</span><textarea v-model="form.source" rows="12" :placeholder="sourcePlaceholder" @input="draftReady=false" /></label>
        <div class="admin-news-actions"><button type="button" class="secondary-button" :disabled="drafting||!canDraft" @click="createDraft"><Wand2 :size="16" />{{ drafting?"작성 중...":"마크다운 자동 작성" }}</button><button v-if="editingId" type="button" class="secondary-button" @click="reset">취소</button><button class="primary-button" :disabled="publishing||drafting||(!editingId&&!draftReady)"><Send :size="16" />{{ publishing?"저장 중...":editingId?"수정 저장":"발행" }}</button></div>
      </section>
      <section class="admin-surface"><header class="admin-surface-head"><span>PREVIEW</span><h2>미리보기</h2></header><div class="admin-news-preview"><h1>{{ form.title||"제목을 입력하세요" }}</h1><textarea v-model="form.markdown" placeholder="자동 작성된 마크다운을 확인하고 바로 수정할 수 있습니다." /></div></section>
    </form>

    <section v-else class="admin-surface news-manage-surface">
      <header class="admin-surface-head manage"><div><span>MANAGE</span><h2>작성된 글 관리</h2></div><div class="news-manage-filter"><button v-for="item in manageCategories" :key="item.value" type="button" :class="{active:manageCategory===item.value}" @click="manageCategory=item.value"><span>{{ item.label }}</span><b>{{ count(item.value) }}</b></button></div></header>
      <div class="admin-table-wrap"><table><thead><tr><th>커버</th><th>유형</th><th>제목</th><th>작성일</th><th>수정일</th><th>조회수</th><th>관리</th></tr></thead><tbody><tr v-if="loading"><td colspan="7">뉴스 목록을 불러오는 중입니다.</td></tr><tr v-else-if="!managed.length"><td colspan="7">선택한 유형에 작성된 뉴스가 없습니다.</td></tr><tr v-for="news in managed" v-else :key="news.news_id"><td><span class="admin-news-thumb"><img v-if="news.cover_image_url" :src="resolveApiUrl(news.cover_image_url)" alt="" /><Newspaper v-else :size="18" /></span></td><td><em :class="['news-type',news.category]">{{ label(news.category) }}</em></td><td><strong>{{ news.title }}</strong><small v-if="news.org_name">{{ news.org_name }}</small></td><td>{{ date(news.created_at) }}</td><td>{{ date(news.updated_at) }}</td><td><span class="view-cell"><Eye :size="14" />{{ news.view_count||0 }}</span></td><td><div class="row-actions"><button type="button" @click="viewNews(news)"><Eye :size="14" />View</button><button type="button" title="수정" @click="edit(news)"><Pencil :size="14" /></button><button type="button" class="danger" title="삭제" @click="deleteTarget=news"><Trash2 :size="14" /></button></div></td></tr></tbody></table></div>
    </section>

    <BaseModal v-if="preview" title="Tech News 상세" size="news" @close="preview=null"><article class="news-popup"><header class="news-popup-head"><div class="news-popup-meta"><span :class="['news-popup-category',preview.category]">{{ label(preview.category) }}</span><time>{{ date(preview.created_at) }}</time><span class="news-popup-views"><Eye :size="14" />{{ preview.view_count||0 }}</span></div><h2>{{ preview.title }}</h2></header><div v-if="preview.cover_image_url" class="news-popup-cover"><img :src="resolveApiUrl(preview.cover_image_url)" alt="" /></div><div class="news-popup-markdown" v-html="renderedMarkdown"></div></article></BaseModal>
    <BaseModal v-if="deleteTarget" title="Tech News 삭제" size="small" @close="deleteTarget=null"><div class="admin-confirm"><span><Trash2 :size="22" /></span><h2>게시글을 삭제할까요?</h2><strong>{{ deleteTarget.title }}</strong><p>삭제한 Tech News는 복구할 수 없습니다.</p><div class="form-buttons equal"><button type="button" class="secondary-button" @click="deleteTarget=null">취소</button><button type="button" class="danger-button" :disabled="publishing" @click="remove">{{ publishing?"삭제 중...":"삭제" }}</button></div></div></BaseModal>
  </div>
</template>

<script setup>
import { computed,onMounted,reactive,ref } from "vue";
import { marked } from "marked";import DOMPurify from "dompurify";
import { Eye,Newspaper,Pencil,Send,Trash2,Wand2 } from "lucide-vue-next";
import BaseModal from "../components/BaseModal.vue";
import { apiFetch,readApiError,resolveApiUrl } from "../api/client";
import { useAuthStore } from "../stores/auth";
const auth=useAuthStore();
const categories=[{value:"wia",label:"위아 뉴스"},{value:"external",label:"외부 뉴스"},{value:"bp",label:"BP 사례"}],manageCategories=[{value:"all",label:"전체"},...categories];
const tab=ref("write"),newsList=ref([]),loading=ref(false),error=ref(""),drafting=ref(false),publishing=ref(false),draftReady=ref(false),editingId=ref(""),manageCategory=ref("all"),preview=ref(null),deleteTarget=ref(null),coverInput=ref(null);
const form=reactive({category:"wia",title:"",org_name:"",source_url:"",source:"",markdown:"",cover:null});
const label=v=>categories.find(x=>x.value===v)?.label||"AI Tech News",date=v=>String(v||"").slice(0,10);
const sourcePlaceholder=computed(()=>form.category==="bp"?"기존 문제, 적용 방식, 적용 단계, 적용 기간, 성과와 참고할 내용을 입력하세요.":"뉴스로 작성할 원문 또는 소스 자료를 붙여 넣으세요.");
const canDraft=computed(()=>form.source.trim()&&(form.category!=="bp"||form.org_name.trim()));
const managed=computed(()=>manageCategory.value==="all"?newsList.value:newsList.value.filter(n=>n.category===manageCategory.value));
const renderedMarkdown=computed(()=>DOMPurify.sanitize(marked.parse(preview.value?.markdown||"")));
const count=v=>v==="all"?newsList.value.length:newsList.value.filter(n=>n.category===v).length;
function changeCategory(value){form.category=value;if(!editingId.value)draftReady.value=false;}
async function load(){loading.value=true;try{const r=await apiFetch("/api/news");if(!r.ok)throw await readApiError(r,"뉴스 목록을 불러오지 못했습니다.");newsList.value=await r.json();}catch(e){error.value=e.message;}finally{loading.value=false;}}
async function createDraft(){drafting.value=true;error.value="";try{const r=await apiFetch("/api/admin/news/draft",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${auth.token}`},body:JSON.stringify({source:form.source.trim(),category:form.category,title:form.title.trim()||null,org_name:form.org_name.trim()||null})});if(!r.ok)throw await readApiError(r,"마크다운을 자동 작성하지 못했습니다.");form.markdown=(await r.json()).markdown;draftReady.value=true;}catch(e){error.value=e.message;}finally{drafting.value=false;}}
function buildForm(){const b=new FormData();b.append("title",form.title.trim());b.append("markdown",form.markdown);b.append("category",form.category);if(form.source_url.trim())b.append("source_url",form.source_url.trim());if(form.org_name.trim())b.append("org_name",form.org_name.trim());if(form.cover)b.append("cover_image",form.cover);return b;}
async function publish(){publishing.value=true;error.value="";try{const r=await apiFetch(editingId.value?`/api/admin/news/${editingId.value}`:"/api/admin/news",{method:editingId.value?"PUT":"POST",headers:{Authorization:`Bearer ${auth.token}`},body:buildForm()});if(!r.ok)throw await readApiError(r,editingId.value?"뉴스를 수정하지 못했습니다.":"뉴스를 발행하지 못했습니다.");reset();await load();tab.value="manage";}catch(e){error.value=e.message;}finally{publishing.value=false;}}
function reset(){editingId.value="";Object.assign(form,{category:"wia",title:"",org_name:"",source_url:"",source:"",markdown:"",cover:null});draftReady.value=false;if(coverInput.value)coverInput.value.value="";}
async function detail(id){const r=await apiFetch(`/api/news/${id}?count_view=false`);if(!r.ok)throw await readApiError(r,"뉴스 내용을 불러오지 못했습니다.");return r.json();}
async function viewNews(news){error.value="";try{preview.value=await detail(news.news_id);}catch(e){error.value=e.message;}}
async function edit(news){error.value="";try{const d=await detail(news.news_id);editingId.value=d.news_id;Object.assign(form,{category:d.category,title:d.title,org_name:d.org_name||"",source_url:d.source_url||"",source:"",markdown:d.markdown||"",cover:null});draftReady.value=true;tab.value="write";}catch(e){error.value=e.message;}}
async function remove(){publishing.value=true;try{const r=await apiFetch(`/api/admin/news/${deleteTarget.value.news_id}`,{method:"DELETE",headers:{Authorization:`Bearer ${auth.token}`}});if(!r.ok)throw await readApiError(r,"뉴스를 삭제하지 못했습니다.");newsList.value=newsList.value.filter(n=>n.news_id!==deleteTarget.value.news_id);deleteTarget.value=null;}catch(e){error.value=e.message;}finally{publishing.value=false;}}
onMounted(load);
</script>
