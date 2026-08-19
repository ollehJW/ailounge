<template>
  <Teleport to="body">
    <div class="ai-lounge-scope ai-lounge-overlay">
      <button class="asset-detail-backdrop" type="button" aria-label="상세 닫기" @click="$emit('close')"></button>
      <aside class="asset-detail-drawer" aria-label="AI 자산 상세">
      <div v-if="loading" class="asset-catalog-detail-loading"><LoaderCircle class="spin" :size="20" />자산 정보를 불러오고 있습니다.</div>
      <template v-else-if="asset">
        <header class="asset-detail-head">
          <button type="button" aria-label="닫기" @click="$emit('close')"><X :size="18" /></button>
          <span>{{ asset.business_area }}</span>
          <h2>{{ asset.asset_name }}</h2>
          <p>{{ asset.description }}</p>
          <div class="asset-detail-owner">
            <div class="asset-detail-owner-icon"><UserRound :size="16" /></div>
            <span>
              <b>{{ asset.owner_name || '자산 담당자' }} <em>{{ asset.owner_job_title }}</em></b>
              <small>{{ asset.owner_org }}</small>
              <button v-if="asset.owner_email" type="button" title="이메일 주소 복사" @click="copy(asset.owner_email)"><Mail :size="11" />{{ asset.owner_email }}</button>
            </span>
          </div>
          <dl>
            <div><dt>{{ asset.maturity_level }}</dt><dd>자산 성숙도</dd></div>
            <div><dt>{{ number(asset.view_count) }}</dt><dd>조회 수</dd></div>
            <div><dt>{{ number(asset.diffusion_attempt_count) }}</dt><dd>확산 시도</dd></div>
            <div><dt>{{ number(asset.diffusion_completed_count) }}</dt><dd>확산 완료</dd></div>
            <div><dt>{{ date(asset.updated_at) }}</dt><dd>업데이트</dd></div>
          </dl>
        </header>

        <nav class="asset-detail-tabs">
          <button v-for="item in tabs" :key="item.key" type="button" :class="{ active: tab === item.key }" @click="selectTab(item.key)">{{ item.label }}</button>
        </nav>

        <div class="asset-detail-body">
          <div v-if="tab === 'overview'" class="asset-detail-definition">
            <section class="problem"><header><span>01</span>문제 정의</header><p>{{ asset.problem_definition }}</p></section>
            <div class="asset-detail-workflow">
              <section><header><span>02</span>As-Is Workflow</header><p>{{ asset.as_is_workflow }}</p></section>
              <ArrowRight :size="20" />
              <section><header><span>03</span>To-Be Workflow</header><p>{{ asset.to_be_workflow }}</p></section>
            </div>
            <section class="effect"><header><span>04</span>AI 개선 효과</header><p>{{ asset.ai_effect }}</p></section>
          </div>

          <div v-else-if="tab === 'tech'" class="asset-detail-stack">
            <section>
              <h3>모델 / 알고리즘</h3>
              <article v-for="(item,index) in asset.models" :key="index"><b>{{ item.model_name || item.name }}</b><p>{{ item.description }}</p><a v-if="item.reference_url" :href="item.reference_url" target="_blank" rel="noreferrer">참조 링크 <ExternalLink :size="12" /></a></article>
              <p v-if="!asset.models?.length" class="asset-detail-empty-copy">등록된 모델 정보가 없습니다.</p>
            </section>
            <section>
              <h3>기술 스택</h3>
              <article v-for="(item,index) in asset.tech_stacks" :key="index"><b>{{ item.stack_name || item.name }}</b><p>{{ item.description }}</p><a v-if="item.reference_url" :href="item.reference_url" target="_blank" rel="noreferrer">참조 링크 <ExternalLink :size="12" /></a></article>
              <p v-if="!asset.tech_stacks?.length" class="asset-detail-empty-copy">등록된 기술 스택 정보가 없습니다.</p>
            </section>
          </div>

          <div v-else-if="tab === 'data'" class="asset-detail-data">
            <section class="asset-detail-copy"><h3>데이터 설명</h3><p>{{ asset.has_data ? (asset.data_description || '등록된 데이터 설명이 없습니다.') : '이 자산은 별도 데이터 첨부 없이 활용할 수 있습니다.' }}</p><span v-if="asset.data_type">{{ asset.data_type }}</span></section>
            <section v-if="asset.has_data">
              <h3>샘플 데이터</h3>
              <div class="asset-detail-download-list">
                <article v-for="file in asset.data_files" :key="file.data_file_id"><Database :size="18" /><div><b>{{ file.file_name }}</b><span>{{ role(file.data_role) }} · {{ fileSize(file.file_size) }}</span></div><button type="button" @click="download(file.download_url,file.file_name)"><Download :size="14" />Download</button></article>
              </div>
              <p v-if="!asset.data_files?.length" class="asset-detail-empty-copy">첨부된 샘플 데이터가 없습니다.</p>
            </section>
          </div>

          <div v-else-if="tab === 'performance'" class="asset-detail-performance">
            <section class="asset-performance-section">
              <header class="asset-performance-title"><div><span>WORKFLOW IMPACT</span><h3>Before / After 비교</h3></div><small>{{ asset.before_after_metrics?.length || 0 }}개 개선 항목</small></header>
              <div v-if="asset.before_after_metrics?.length" class="asset-performance-comparisons">
                <article v-for="(item,index) in asset.before_after_metrics" :key="index">
                  <div class="asset-performance-metric"><span>{{ String(index + 1).padStart(2, '0') }}</span><b>{{ item.metric_name }}</b><em>{{ item.improvement_rate }}</em></div>
                  <div class="asset-performance-values"><div class="before"><small>BEFORE</small><strong>{{ item.before_value }}</strong></div><span class="asset-performance-arrow"><ArrowRight :size="17" /></span><div class="after"><small>AFTER</small><strong>{{ item.after_value }}</strong></div></div>
                </article>
              </div>
              <p v-else class="asset-detail-empty-copy">등록된 비교 지표가 없습니다.</p>
            </section>
            <section class="asset-performance-section">
              <header class="asset-performance-title"><div><span>PERFORMANCE KPI</span><h3>성능 지표</h3></div></header>
              <div v-if="asset.performance_metrics?.length" class="asset-performance-kpis">
                <article v-for="(item,index) in asset.performance_metrics" :key="index"><div class="asset-kpi-icon"><CheckCircle2 :size="18" /></div><div class="asset-kpi-copy"><span>{{ item.metric_name }}</span><p>{{ item.description }}</p></div><b>{{ item.value }}</b></article>
              </div>
              <p v-else class="asset-detail-empty-copy">등록된 성능 지표가 없습니다.</p>
            </section>
          </div>

          <div v-else-if="tab === 'demo'">
            <div v-if="currentSlide" class="asset-detail-demo">
              <button class="asset-demo-stage" type="button" :aria-label="`${currentSlide.caption || asset.asset_name} 원본 이미지 보기`" @click="lightbox = true">
                <img :src="apiUrl(currentSlide.url)" :alt="currentSlide.caption || asset.asset_name" />
                <span class="asset-demo-expand" title="원본 이미지 보기"><Maximize2 :size="16" /></span>
              </button>
              <div class="asset-demo-caption">
                <span>{{ String(slideIndex + 1).padStart(2, '0') }} / {{ String(asset.slides.length).padStart(2, '0') }}</span>
                <div><b>{{ currentSlide.caption || '자산 활용 화면' }}</b><p>{{ currentSlide.description }}</p></div>
                <div><button type="button" aria-label="이전 이미지" :disabled="slideIndex === 0" @click="slideIndex--">←</button><button type="button" aria-label="다음 이미지" :disabled="slideIndex >= asset.slides.length - 1" @click="slideIndex++">→</button></div>
              </div>
            </div>
            <div v-else class="asset-detail-empty"><Layers3 :size="26" /><b>등록된 자산 활용 화면이 없습니다.</b></div>
          </div>

          <div v-else-if="tab === 'diffusion'" class="asset-detail-diffusion">
            <section class="asset-vibe-guide">
              <span>VIBE CODING GUIDE</span>
              <h3>Claude와 함께 우리 업무에 맞게 확산하세요</h3>
              <p>Git 저장소와 확산 패키지를 준비한 뒤, 업무 환경과 데이터 구조에 맞춰 자연어로 변경 사항을 요청할 수 있습니다.</p>
              <ol><li v-for="(step,index) in diffusionSteps" :key="step"><span>{{ index + 1 }}</span>{{ step }}</li></ol>
            </section>
            <div class="asset-diffusion-actions">
              <section><GitBranch :size="20" /><div><b>Git 저장소</b><p>{{ asset.repo_url || '등록된 Git 주소가 없습니다.' }}</p></div><button v-if="asset.repo_url" type="button" :class="{ copied }" @click="copyRepo">{{ copied ? 'Copied' : 'Copy' }}</button></section>
              <section><Download :size="20" /><div><b>확산 패키지</b><p>CLAUDE.md와 재사용 가능한 Skills를 포함합니다.</p></div><button type="button" :disabled="!asset.skill_download_url" @click="download(asset.skill_download_url,`${asset.asset_name}_skills.zip`)">Download</button></section>
            </div>
          </div>

          <DiffusionCases v-else-if="tab === 'cases'" :asset="asset" @count-change="$emit('count-change',$event)" />
          <AssetQa v-else-if="tab === 'qa'" :asset-id="asset.asset_id" />
        </div>
      </template>
      <div v-else class="asset-catalog-detail-error">{{ error || '자산 정보를 불러오지 못했습니다.' }}</div>
      </aside>

      <div v-if="lightbox && currentSlide" class="asset-image-lightbox" role="dialog" aria-modal="true" aria-label="자산 활용 원본 이미지" @mousedown="lightbox = false">
        <section class="asset-image-lightbox-panel" @mousedown.stop>
          <header><div><span>ORIGINAL IMAGE</span><b>{{ currentSlide.caption || '자산 활용 화면' }}</b></div><button type="button" aria-label="원본 이미지 닫기" @click="lightbox = false"><X :size="19" /></button></header>
          <div class="asset-image-lightbox-canvas"><img :src="apiUrl(currentSlide.url)" :alt="currentSlide.caption || asset.asset_name" /></div>
          <p v-if="currentSlide.description">{{ currentSlide.description }}</p>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref } from "vue";import { ArrowRight,CheckCircle2,Database,Download,ExternalLink,GitBranch,Layers3,LoaderCircle,Mail,Maximize2,UserRound,X } from "lucide-vue-next";
import { apiFetch, readApiError, resolveApiUrl } from "../api/client";import DiffusionCases from "./DiffusionCases.vue";import AssetQa from "./AssetQa.vue";
const props=defineProps({asset:Object,loading:Boolean,error:String});defineEmits(["close","count-change"]);const tab=ref("overview"),slideIndex=ref(0),lightbox=ref(false),copied=ref(false);
const tabs=[{key:"overview",label:"과제 설명"},{key:"tech",label:"적용 기술"},{key:"data",label:"데이터"},{key:"performance",label:"성능 지표"},{key:"demo",label:"자산 활용"},{key:"diffusion",label:"확산 가이드"},{key:"cases",label:"확산 사례"},{key:"qa",label:"Q&A"}];
const diffusionSteps=["Git 저장소를 내려받아 프로젝트 폴더를 준비합니다.","Skills ZIP을 내려받아 프로젝트 루트에 압축 해제합니다.","Claude Coding Agent에서 프로젝트를 열어 자산 구조를 확인합니다.","적용 업무, 데이터 경로, 운영 환경과 검증 기준을 설명합니다.","수정된 코드를 실행하고 실제 업무 기준으로 결과를 검증합니다."];
const currentSlide=computed(()=>props.asset?.slides?.[slideIndex.value]);const number=value=>Number(value||0).toLocaleString(),date=value=>String(value||"").slice(0,10),role=value=>({train:"학습",validation:"검증",sample:"샘플"}[value]||value),apiUrl=resolveApiUrl;
const fileSize=value=>{const n=Number(value||0);return n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;};const selectTab=value=>{tab.value=value;if(value==="demo")slideIndex.value=0;};
async function copy(value){await navigator.clipboard.writeText(value);}async function copyRepo(){await copy(props.asset.repo_url);copied.value=true;setTimeout(()=>copied.value=false,1500);}
async function download(path,name){const response=await apiFetch(path);if(!response.ok)throw await readApiError(response,"파일을 내려받지 못했습니다.");const url=URL.createObjectURL(await response.blob());const link=document.createElement("a");link.href=url;link.download=name;link.click();URL.revokeObjectURL(url);}
</script>
