<template>
  <div class="community-page usage-page">
      <p v-if="error" class="form-error page-error">{{ error }}</p>
      <section v-if="hotPosts.length" class="hot-feature">
        <div class="hot-feature-label"><span>WEEKLY TOP</span><strong>이번 주 가장 핫한 활용법</strong></div>
        <button type="button" class="hot-feature-content" @click="openDetail(hotPosts[hotIndex])">
          <b class="hot-rank">0{{ hotIndex + 1 }}</b>
          <div><span :class="['usage-chip', categoryClass(hotPosts[hotIndex].category)]">{{ hotPosts[hotIndex].category }}</span><h2>{{ hotPosts[hotIndex].title }}</h2><p>{{ preview(hotPosts[hotIndex].content_text, 110) }}</p><footer><span>{{ author(hotPosts[hotIndex]) }}</span><span><Eye :size="14" />{{ hotPosts[hotIndex].view_count }}</span><span><Heart :size="14" />{{ hotPosts[hotIndex].like_count }}</span></footer></div>
          <span class="hot-dots" @click.stop><button v-for="(_, index) in hotPosts" :key="index" type="button" :class="{ active: hotIndex === index }" @click="hotIndex = index"></button></span>
        </button>
      </section>

      <section class="board-panel">
        <header class="board-header"><div><span>COMMUNITY BOARD</span><h2>활용법 게시판</h2><p>업무에서 직접 시도한 AI 경험과 시행착오를 공유합니다.</p></div><div class="board-actions"><label class="search-box compact"><Search :size="16" /><input v-model="query" placeholder="제목, 내용 검색" /></label><button type="button" class="primary-button" @click="openComposer()"><Plus :size="17" />게시글 작성</button></div></header>
        <div class="board-filters"><div class="segment-control"><button v-for="option in categories" :key="option" type="button" :class="{ active: categoryFilter === option }" @click="categoryFilter = option">{{ option }}</button></div><div class="sort-control"><button type="button" :class="{ active: sortOrder === 'latest' }" @click="sortOrder = 'latest'">최신순</button><button type="button" :class="{ active: sortOrder === 'popular' }" @click="sortOrder = 'popular'">인기순</button></div></div>
        <div v-if="loading" class="content-state"><LoaderCircle class="spin" :size="28" /><span>활용법을 불러오는 중입니다.</span></div>
        <div v-else-if="filteredPosts.length" class="usage-list">
          <article v-for="post in filteredPosts" :key="post.usage_post_id" class="usage-row" @click="openDetail(post)">
            <i :class="['usage-mark', categoryClass(post.category)]"></i>
            <div class="usage-row-main"><div><span :class="['usage-chip', categoryClass(post.category)]">{{ post.category }}</span><h3>{{ post.title }}</h3></div><p>{{ preview(post.content_text, 80) }}</p><footer><span>{{ post.author_org }}</span><strong>{{ post.author_name }} {{ post.author_job_title }}</strong><time>{{ formatDate(post.created_at) }}</time></footer></div>
            <div class="usage-row-actions" @click.stop><span><Eye :size="15" />{{ post.view_count }}</span><button type="button" :class="['like-button', { active: post.liked_by_me }]" @click="toggleLike(post)"><Heart :size="15" :fill="post.liked_by_me ? 'currentColor' : 'none'" />{{ post.like_count }}</button><button v-if="isMine(post)" type="button" class="small-line-button" @click="openComposer(post)"><Pencil :size="14" />수정</button></div>
          </article>
        </div>
        <div v-else class="content-state empty"><MessageSquareText :size="34" /><strong>등록된 활용법이 없습니다.</strong><span>첫 활용 경험을 공유해 주세요.</span></div>
      </section>

      <BaseModal v-if="selectedPostId" title="AI 활용법 상세" size="medium" @close="closeDetail">
        <div v-if="detailLoading" class="content-state modal-loading"><LoaderCircle class="spin" :size="28" /><span>게시글을 불러오는 중입니다.</span></div>
        <article v-else-if="selectedPost" class="usage-reader"><header><span :class="['usage-chip', categoryClass(selectedPost.category)]">{{ selectedPost.category }}</span><h2>{{ selectedPost.title }}</h2><div class="author-line"><span class="person-icon"><UserRound :size="18" /></span><div><strong>{{ selectedPost.author_name }} {{ selectedPost.author_job_title }}</strong><span>{{ selectedPost.author_org }} · {{ formatDate(selectedPost.created_at) }}</span></div></div></header><div class="usage-reader-content" v-html="selectedPost.content_html"></div><footer><button type="button" :class="['like-button large', { active: selectedPost.liked_by_me }]" @click="toggleLike(selectedPost)"><Heart :size="17" :fill="selectedPost.liked_by_me ? 'currentColor' : 'none'" />도움이 됐어요 {{ selectedPost.like_count }}</button></footer></article>
      </BaseModal>

      <BaseModal v-if="composerOpen" :title="editingId ? '활용법 수정' : '활용법 작성'" size="medium" @close="closeComposer">
        <form class="editor-form" @submit.prevent="submitPost"><header><span>SHARE YOUR PRACTICE</span><h2>{{ editingId ? "활용법 수정" : "활용법 작성" }}</h2><p>실제로 시도한 과정과 배운 점을 자유롭게 작성해 주세요.</p></header>
          <label class="form-field"><span>제목 <b>*</b></span><input v-model="form.title" maxlength="120" placeholder="글의 핵심이 드러나는 제목을 작성해 주세요." required /></label>
          <label class="form-field"><span>경험 유형 <b>*</b></span><select v-model="form.category"><option v-for="item in categories.slice(1)" :key="item">{{ item }}</option></select></label>
          <div class="form-field"><span>내용 <b>*</b></span><div class="rich-toolbar"><button type="button" :class="{ active: formats.bold }" title="굵게" @mousedown.prevent="format('bold')"><Bold :size="17" /></button><button type="button" :class="{ active: formats.underline }" title="밑줄" @mousedown.prevent="format('underline')"><Underline :size="17" /></button><div class="color-tool"><button type="button" title="글자 색상" @mousedown.prevent="colorOpen = !colorOpen"><Palette :size="17" /><i :style="{ background: selectedColor }"></i></button><div v-if="colorOpen" class="color-palette"><button v-for="color in colors" :key="color" type="button" :style="{ background: color }" :aria-label="`글자색 ${color}`" @mousedown.prevent="applyColor(color)"></button><label>다른 색<input type="color" :value="selectedColor" @input="applyColor($event.target.value)" /></label></div></div></div>
            <div ref="editor" class="rich-editor" contenteditable="true" data-placeholder="업무에 어떻게 활용했는지, 무엇을 배웠는지 작성해 주세요." @input="syncContent" @mouseup="captureSelection" @keyup="captureSelection" @paste="handlePaste"></div>
          </div><p v-if="composerError" class="form-error">{{ composerError }}</p><div class="form-buttons equal"><button type="button" class="secondary-button" @click="closeComposer">취소</button><button class="primary-button" :disabled="saving">{{ saving ? "저장 중..." : editingId ? "수정" : "게시" }}</button></div>
        </form>
      </BaseModal>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { Bold, Eye, Heart, LoaderCircle, MessageSquareText, Palette, Pencil, Plus, Search, Underline, UserRound } from "lucide-vue-next";
import BaseModal from "@/components/BaseModal.vue";
import { apiFetch, readApiError } from "@/api/client"; import { useAuthStore } from "@/stores/auth";
const auth = useAuthStore(); const posts = ref([]); const loading = ref(true); const error = ref(""); const query = ref(""); const categoryFilter = ref("전체"); const sortOrder = ref("latest"); const hotIndex = ref(0);
const categories = ["전체", "확산 사례", "실패·교훈", "Tip 공유"]; const selectedPostId = ref(""); const selectedPost = ref(null); const detailLoading = ref(false);
const composerOpen = ref(false); const editingId = ref(""); const saving = ref(false); const composerError = ref(""); const editor = ref(null); const colorOpen = ref(false); const selectedColor = ref("#151721"); let savedRange = null;
const form = reactive({ title: "", category: "확산 사례", content_html: "" }); const formats = reactive({ bold: false, underline: false });
const colors = ["#151721", "#0a2469", "#0b7bff", "#23754c", "#b13b3b", "#7042a0", "#c46a13", "#666a78"];
const hotPosts = computed(() => [...posts.value].sort((a,b) => b.like_count-a.like_count).slice(0,3));
const filteredPosts = computed(() => { const keyword=query.value.trim().toLowerCase(); return posts.value.filter((post)=>(categoryFilter.value==="전체"||post.category===categoryFilter.value)&&(!keyword||`${post.title} ${post.content_text}`.toLowerCase().includes(keyword))).sort((a,b)=>sortOrder.value==="popular"?b.like_count-a.like_count:String(b.created_at).localeCompare(String(a.created_at))); });
const formatDate=(value)=>String(value||"").slice(0,10); const preview=(value,length)=>{const text=String(value||"").replace(/\s+/g," ").trim();return `${text.slice(0,length)}${text.length>length?"...":""}`;}; const author=(post)=>`${post.author_org||""} · ${post.author_name||""} ${post.author_job_title||""}`; const isMine=(post)=>post.user_id===auth.user?.user_id; const categoryClass=(value)=>({"확산 사례":"spread","실패·교훈":"lesson","Tip 공유":"tip"}[value]||"spread");
const loadPosts=async()=>{loading.value=true;error.value="";try{const response=await apiFetch("/api/usage-posts");if(!response.ok)throw await readApiError(response,"AI 활용법을 불러오지 못했습니다.");posts.value=await response.json();}catch(loadError){error.value=loadError.message;}finally{loading.value=false;}};
const loadDetail=async(id,countView=true)=>{const response=await apiFetch(`/api/usage-posts/${id}?count_view=${countView}`);if(!response.ok)throw await readApiError(response,"게시글을 불러오지 못했습니다.");const detail=await response.json();const index=posts.value.findIndex((item)=>item.usage_post_id===id);if(index>=0)posts.value[index]={...posts.value[index],...detail,content_html:undefined};return detail;};
const openDetail=async(post)=>{selectedPostId.value=post.usage_post_id;selectedPost.value=null;detailLoading.value=true;try{selectedPost.value=await loadDetail(post.usage_post_id,true);}catch(loadError){error.value=loadError.message;selectedPostId.value="";}finally{detailLoading.value=false;}}; const closeDetail=()=>{selectedPostId.value="";selectedPost.value=null;};
const toggleLike=async(post)=>{try{const response=await apiFetch(`/api/usage-posts/${post.usage_post_id}/like`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`}});if(!response.ok)throw await readApiError(response,"좋아요를 반영하지 못했습니다.");const updated=await response.json();const index=posts.value.findIndex((item)=>item.usage_post_id===updated.usage_post_id);if(index>=0)posts.value[index]={...posts.value[index],...updated};if(selectedPost.value?.usage_post_id===updated.usage_post_id)selectedPost.value={...selectedPost.value,...updated};}catch(actionError){error.value=actionError.message;}};
const openComposer=async(post=null)=>{composerError.value="";selectedPostId.value="";try{const detail=post?await loadDetail(post.usage_post_id,false):null;editingId.value=detail?.usage_post_id||"";form.title=detail?.title||"";form.category=detail?.category||"확산 사례";form.content_html=detail?.content_html||"";composerOpen.value=true;await nextTick();if(editor.value)editor.value.innerHTML=form.content_html;}catch(loadError){error.value=loadError.message;}}; const closeComposer=()=>{composerOpen.value=false;editingId.value="";colorOpen.value=false;savedRange=null;};
const syncContent=()=>{form.content_html=editor.value?.innerHTML||"";captureSelection();}; const captureSelection=()=>{const selection=window.getSelection();if(selection?.rangeCount&&editor.value?.contains(selection.anchorNode)){savedRange=selection.getRangeAt(0).cloneRange();formats.bold=document.queryCommandState("bold");formats.underline=document.queryCommandState("underline");}}; const restoreSelection=()=>{if(!savedRange)return;const selection=window.getSelection();selection.removeAllRanges();selection.addRange(savedRange);};
const format=(command)=>{editor.value?.focus();restoreSelection();document.execCommand(command);syncContent();}; const applyColor=(color)=>{selectedColor.value=color;editor.value?.focus();restoreSelection();document.execCommand("foreColor",false,color);syncContent();colorOpen.value=false;};
const handlePaste=(event)=>{const images=[...(event.clipboardData?.items||[])].filter((item)=>item.type.startsWith("image/"));if(!images.length)return;event.preventDefault();images.forEach((item)=>{const file=item.getAsFile();if(!file)return;const reader=new FileReader();reader.onload=()=>{editor.value?.focus();restoreSelection();document.execCommand("insertImage",false,String(reader.result));syncContent();};reader.readAsDataURL(file);});};
const submitPost=async()=>{syncContent();if(!form.title.trim()||!form.content_html.replace(/<[^>]*>/g,"").trim()){composerError.value="제목과 내용을 모두 작성해 주세요.";return;}saving.value=true;composerError.value="";try{const response=await apiFetch(`/api/usage-posts${editingId.value?`/${editingId.value}`:""}`,{method:editingId.value?"PUT":"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${auth.token}`},body:JSON.stringify({title:form.title.trim(),category:form.category,content_html:form.content_html})});if(!response.ok)throw await readApiError(response,editingId.value?"게시글을 수정하지 못했습니다.":"게시글을 등록하지 못했습니다.");await loadPosts();closeComposer();}catch(saveError){composerError.value=saveError.message;}finally{saving.value=false;}};
let timer;onMounted(()=>{loadPosts();timer=window.setInterval(()=>{if(hotPosts.value.length)hotIndex.value=(hotIndex.value+1)%hotPosts.value.length;},5000);});onBeforeUnmount(()=>window.clearInterval(timer));
</script>

