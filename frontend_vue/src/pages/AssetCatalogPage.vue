<template>
  <div class="studio-page catalog-page">
      <section class="asset-recommendation-panel" :class="{ 'has-results': recommended.length }">
        <div class="asset-recommendation-intro">
          <div class="asset-recommendation-icon"><Sparkles :size="20" /></div>
          <div>
            <span>AI ASSET MATCH</span>
            <h2>해결하려는 과제를 알려주세요</h2>
            <p>운영 중인 AI 자산을 분석해 업무에 적합한 자산과 활용 방향을 추천합니다.</p>
          </div>
        </div>

        <form class="asset-recommendation-form" @submit.prevent="recommend">
          <textarea
            v-model="recommendQuery"
            maxlength="1000"
            placeholder="예: 생산라인별 품질 데이터를 취합해 주간 보고서를 자동으로 작성하고 싶어요."
            aria-label="해결하려는 과제"
          ></textarea>
          <button type="submit" :disabled="recommendQuery.trim().length < 5 || recommending || loading || !assets.length">
            <LoaderCircle v-if="recommending" class="spin" :size="16" />
            <Wand2 v-else :size="16" />
            {{ recommending ? '분석 중' : '자산 추천' }}
          </button>
        </form>

        <div v-if="recommending" class="asset-recommendation-progress">
          <LoaderCircle class="spin" :size="19" />
          <div>
            <b>등록된 자산을 분석하고 있습니다</b>
            <small>과제 적합성과 활용 가능성을 비교해 최대 3개를 선별합니다.</small>
          </div>
        </div>
        <div v-else-if="recommendError" class="asset-recommendation-error">{{ recommendError }}</div>
        <div v-else-if="recommendationAttempted && !recommended.length" class="asset-recommendation-empty">
          현재 과제와 충분히 일치하는 운영 자산을 찾지 못했습니다. 업무 목적이나 처리 방식을 조금 더 구체적으로 작성해보세요.
        </div>

        <div v-if="recommended.length" class="asset-recommendation-results">
          <header>
            <div><span>RECOMMENDED ASSETS</span><h3>이 과제에 적합한 자산</h3></div>
            <small>{{ recommended.length }}개 추천</small>
          </header>
          <div class="asset-recommendation-grid">
            <article
              v-for="(asset, index) in recommended"
              :key="asset.asset_id"
              tabindex="0"
              role="button"
              @click="openAsset(asset)"
              @keydown.enter="openAsset(asset)"
            >
              <div class="asset-recommendation-rank">
                <span>{{ String(index + 1).padStart(2, '0') }}</span>
                <b>{{ asset.recommendation.score }}</b>
                <small>적합도</small>
              </div>
              <div class="asset-recommendation-content">
                <span>{{ asset.business_area }} · {{ asset.maturity_level }}</span>
                <h4>{{ asset.asset_name }}</h4>
                <p>{{ asset.description }}</p>
                <dl>
                  <div><dt>추천 이유</dt><dd>{{ asset.recommendation.reason }}</dd></div>
                  <div><dt>수정·활용 방향</dt><dd>{{ asset.recommendation.adaptation }}</dd></div>
                </dl>
                <button type="button" @click.stop="openAsset(asset)">자산 상세보기 <ArrowRight :size="13" /></button>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section class="asset-collection-section">
        <header>
          <div>
            <span>MY COLLECTION</span>
            <h2>내 컬렉션</h2>
            <p>관심 자산을 모아두고 상세 정보와 확산 현황을 빠르게 확인합니다.</p>
          </div>
          <small><Star :size="13" fill="currentColor" />{{ bookmarked.length }}개 저장됨</small>
        </header>
        <div v-if="bookmarked.length" class="asset-catalog-grid asset-collection-catalog-grid">
          <AssetCard v-for="asset in bookmarked" :key="asset.asset_id" :asset="asset" @open="openAsset" @bookmark="toggleBookmark" />
        </div>
        <div v-else class="asset-collection-empty">
          <Star :size="17" />
          <span>관심 자산의 별표를 누르면 이곳에서 빠르게 확인할 수 있습니다.</span>
        </div>
      </section>

      <div class="asset-catalog-layout">
        <aside class="asset-catalog-filter">
          <header><h2>필터</h2><button type="button" @click="filters = {}">초기화</button></header>
          <section v-for="group in filterGroups" :key="group.key">
            <div><b>{{ group.label }}</b><span>{{ group.options.length }}</span></div>
            <div class="asset-filter-options">
              <button
                v-for="option in group.options"
                :key="option"
                type="button"
                :class="{ active: (filters[group.key] || []).includes(option) }"
                @click="toggleFilter(group.key, option)"
              >{{ option }}</button>
            </div>
          </section>
        </aside>

        <div class="asset-catalog-main">
          <div class="asset-catalog-search">
            <Search :size="17" />
            <input v-model="query" type="search" placeholder="자산명, 설명, 태그로 검색..." />
          </div>
          <div class="asset-catalog-toolbar">
            <div><b>{{ filtered.length }}</b>개 자산 표시<span>{{ selectedFilterCount ? ' · 선택한 필터 적용 중' : ' · 전체 운영 자산' }}</span></div>
            <div>
              <button type="button" :class="{ active: sort === 'popular' }" @click="sort = 'popular'">인기순</button>
              <button type="button" :class="{ active: sort === 'latest' }" @click="sort = 'latest'">최신순</button>
            </div>
          </div>
          <div class="asset-catalog-results-scroll">
            <div v-if="loading" class="asset-catalog-message"><LoaderCircle class="spin" :size="17" />운영 자산을 불러오고 있습니다.</div>
            <div v-else-if="error" class="asset-catalog-message error">{{ error }}</div>
            <div v-else-if="!filtered.length" class="asset-catalog-empty">
              <Search :size="24" />
              <b>조건에 맞는 자산이 없습니다</b>
              <span>검색어나 필터 조건을 조정해보세요.</span>
            </div>
            <div v-else class="asset-catalog-grid">
              <AssetCard v-for="asset in filtered" :key="asset.asset_id" :asset="asset" @open="openAsset" @bookmark="toggleBookmark" />
            </div>
          </div>
        </div>
      </div>
      <AssetDetailDrawer v-if="drawerOpen" :asset="selected" :loading="detailLoading" :error="detailError" @close="closeDrawer" @count-change="updateDiffusionCount" />
  </div>
</template>

<script setup>
import { computed,onMounted,ref,watch } from "vue";import { useRoute,useRouter } from "vue-router";import { ArrowRight,LoaderCircle,Search,Sparkles,Star,Wand2 } from "lucide-vue-next";import AssetCard from "../components/AssetCard.vue";import AssetDetailDrawer from "../components/AssetDetailDrawer.vue";import { apiFetch,readApiError } from "../api/client";
const business=["생산·제조","품질","R&D·설계","SCM·구매·물류","영업·마케팅","경영지원","안전·환경·보건","IT·DX","공통"],tasks=["예측","탐지","분류","검색","질의응답","요약","생성","추출","추천","분석","최적화","자동화"],implementations=["ML","DL","Computer Vision","LLM","RAG","Agent","Rule-Based","Hybrid"],dataTypes=["테이블·정형데이터","시계열 데이터","센서·IoT 데이터","문서·텍스트","이미지","영상","음성","로그","CAD·도면","코드","웹·외부 데이터","복합 데이터"],maturity=["아이디어","PoC","Pilot","운영"];
const filterGroups=[{key:"business_area",label:"업무 영역",options:business},{key:"task_types",label:"Task 유형",options:tasks},{key:"implementation_types",label:"구현 방식",options:implementations},{key:"data_type",label:"Data 유형",options:dataTypes},{key:"maturity_level",label:"자산 성숙도",options:maturity}];
const route=useRoute(),router=useRouter(),assets=ref([]),loading=ref(true),error=ref(""),query=ref(""),sort=ref("popular"),filters=ref({}),recommendQuery=ref(""),recommending=ref(false),recommendError=ref(""),recommendations=ref([]),recommendationAttempted=ref(false),drawerOpen=ref(false),selected=ref(null),detailLoading=ref(false),detailError=ref("");
const bookmarked=computed(()=>assets.value.filter(item=>item.is_bookmarked));const selectedFilterCount=computed(()=>Object.values(filters.value).flat().length);const filtered=computed(()=>{const keyword=query.value.trim().toLowerCase();const result=assets.value.filter(asset=>{if(keyword&&!`${asset.asset_name} ${asset.description} ${(asset.tags||[]).join(" ")}`.toLowerCase().includes(keyword))return false;return filterGroups.every(group=>{const chosen=filters.value[group.key]||[];if(!chosen.length)return true;const value=asset[group.key];return Array.isArray(value)?chosen.some(item=>value.includes(item)):chosen.includes(value);});});return result.sort((a,b)=>sort.value==="popular"?Number(b.diffusion_attempt_count)-Number(a.diffusion_attempt_count):String(b.updated_at).localeCompare(String(a.updated_at)));});
const recommended=computed(()=>recommendations.value.map(rec=>{const asset=assets.value.find(item=>item.asset_id===rec.asset_id);return asset?{...asset,recommendation:rec}:null;}).filter(Boolean));
async function call(path,options={},fallback){const response=await apiFetch(path,options);if(!response.ok)throw await readApiError(response,fallback);return response.status===204?null:response.json();}async function load(){loading.value=true;try{assets.value=await call("/api/assets/catalog",{},"자산을 불러오지 못했습니다.");await openQueryAsset();}catch(e){error.value=e.message;}finally{loading.value=false;}}
function toggleFilter(key,value){const current=filters.value[key]||[];filters.value={...filters.value,[key]:current.includes(value)?current.filter(item=>item!==value):[...current,value]};}
async function toggleBookmark(asset){const next=!asset.is_bookmarked;try{await call(`/api/assets/catalog/${asset.asset_id}/bookmark`,{method:next?"POST":"DELETE"},"컬렉션을 변경하지 못했습니다.");asset.is_bookmarked=next;}catch(e){error.value=e.message;}}
async function recommend(){recommending.value=true;recommendationAttempted.value=false;recommendError.value="";recommendations.value=[];try{const result=await call("/api/assets/recommendations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:recommendQuery.value.trim()})},"자산을 추천하지 못했습니다.");recommendations.value=result.recommendations||[];}catch(e){recommendError.value=e.message;}finally{recommendationAttempted.value=true;recommending.value=false;}}
async function openAsset(asset){drawerOpen.value=true;detailLoading.value=true;detailError.value="";selected.value=null;router.replace({query:{...route.query,asset:asset.asset_id}});try{const detail=await call(`/api/assets/catalog/${asset.asset_id}`,{},"자산 상세를 불러오지 못했습니다.");selected.value=detail;const index=assets.value.findIndex(item=>item.asset_id===detail.asset_id);if(index>=0)assets.value[index]={...assets.value[index],view_count:detail.view_count,is_bookmarked:detail.is_bookmarked};}catch(e){detailError.value=e.message;}finally{detailLoading.value=false;}}
const closeDrawer=()=>{drawerOpen.value=false;selected.value=null;const next={...route.query};delete next.asset;router.replace({query:next});};async function openQueryAsset(){const id=String(route.query.asset||"");if(id){const asset=assets.value.find(item=>item.asset_id===id);if(asset)await openAsset(asset);}}function updateDiffusionCount(count){if(selected.value)selected.value.diffusion_completed_count=count;const item=assets.value.find(a=>a.asset_id===selected.value?.asset_id);if(item)item.diffusion_completed_count=count;}
watch(()=>route.query.asset,id=>{if(id&&!drawerOpen.value&&assets.value.length)openQueryAsset();});onMounted(load);
</script>
