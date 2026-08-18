<template>
  <AppLayout>
    <div class="studio-page intro-page">
      <section class="studio-hero">
        <img src="../assets/ai-studio-intro-hero.png" alt="AI 자산을 연결하는 디지털 업무 환경" />
        <div class="studio-hero-shade"></div>
        <div class="studio-hero-copy"><span>AI STUDIO</span><h2>검증된 AI를<br />전사의 실행력으로.</h2><p>업무 과제를 구체화하고 완성된 AI 자산을 등록·탐색·확산해 개인의 개발 결과를 조직의 역량으로 연결합니다.</p></div>
      </section>

      <nav class="studio-entry-grid" aria-label="AI STUDIO 주요 기능">
        <RouterLink v-for="entry in entries" :key="entry.to" :to="entry.to"><span><component :is="entry.icon" :size="20" /></span><small>{{ entry.number }} · {{ entry.eyebrow }}</small><strong>{{ entry.title }}</strong><p>{{ entry.description }}</p><em>{{ entry.action }} <ArrowRight :size="14" /></em></RouterLink>
      </nav>

      <section class="studio-section">
        <header class="studio-section-head"><span>WHY AI STUDIO</span><h2>AI 개발 결과가 조직의 자산이 되는 구조</h2><p>과제 발굴부터 검증된 자산의 재사용과 현업 확산까지 하나의 흐름으로 연결합니다.</p></header>
        <div class="studio-value-grid"><article v-for="(value,index) in values" :key="value.title"><div><component :is="value.icon" :size="19" /></div><small>0{{ index + 1 }} · {{ value.label }}</small><h3>{{ value.title }}</h3><p>{{ value.description }}</p></article></div>
      </section>

      <section class="studio-process">
        <header class="studio-section-head"><span>DIFFUSION PROCESS</span><h2>AI 자산 확산의 4단계</h2><p>과제를 찾는 순간부터 적용 경험이 다시 플랫폼에 축적될 때까지 이어집니다.</p></header>
        <ol><li v-for="(item,index) in process" :key="item.title"><b>0{{ index + 1 }}</b><div><strong>{{ item.title }}</strong><p>{{ item.description }}</p></div><ArrowRight v-if="index < process.length - 1" :size="18" /></li></ol>
      </section>

      <section class="studio-section impact-section">
        <header class="studio-section-head"><span>AI ASSET IMPACT</span><h2>AI 자산 운영 현황</h2><p>현재 운영 중인 자산의 탐색과 확산 활동을 실제 데이터로 확인합니다.</p></header>
        <div v-if="loading" class="content-state"><LoaderCircle class="spin" :size="28" />운영 현황을 불러오는 중입니다.</div>
        <div v-else-if="error" class="content-state"><AlertCircle :size="26" /><strong>{{ error }}</strong><button class="secondary-button" @click="loadSummary">다시 시도</button></div>
        <template v-else-if="summary">
          <div class="studio-kpis"><article v-for="kpi in kpis" :key="kpi.label"><span><component :is="kpi.icon" :size="18" /></span><b>{{ number(kpi.value) }}</b><small>{{ kpi.label }}</small></article></div>
          <div class="studio-dashboard">
            <article class="dashboard-card monthly-card"><header><div><small>6 MONTH ACTIVITY</small><h3>월별 등록 및 다운로드</h3></div><div class="chart-legend"><span><i class="registered"></i>등록</span><span><i class="downloaded"></i>다운로드</span></div></header><div class="monthly-chart"><div v-for="item in summary.monthly_activity" :key="item.month" class="month-column" tabindex="0"><div class="bar-pair"><i class="registered" :style="{height:barHeight(item.registrations)}"></i><i class="downloaded" :style="{height:barHeight(item.downloads)}"></i></div><span>{{ item.label }}</span><div class="chart-tooltip"><strong>{{ item.label }}</strong><span>등록 {{ item.registrations }}건</span><span>다운로드 {{ item.downloads }}건</span></div></div></div></article>
            <article class="dashboard-card"><header><div><small>BUSINESS AREA</small><h3>업무 영역별 자산</h3></div></header><div class="area-distribution"><div v-for="item in summary.business_distribution" :key="item.label"><span><b>{{ item.label }}</b><em>{{ item.count }}</em></span><i><b :style="{width:areaWidth(item.count)}"></b></i></div><p v-if="!summary.business_distribution.length">운영 중인 자산이 없습니다.</p></div></article>
            <article class="dashboard-card top-assets"><header><div><small>TOP ASSETS</small><h3>누적 다운로드 상위 자산</h3></div><RouterLink to="/studio/assets">전체 보기 <ArrowRight :size="13" /></RouterLink></header><div><button v-for="(asset,index) in summary.top_assets" :key="asset.asset_id" @click="openAsset(asset.asset_id)"><span>0{{ index + 1 }}</span><div><b>{{ asset.asset_name }}</b><small>{{ asset.business_area }} · {{ asset.maturity_level }}</small></div><em>{{ number(asset.diffusion_attempt_count) }}회</em></button><p v-if="!summary.top_assets.length">운영 중인 자산이 없습니다.</p></div></article>
          </div>
        </template>
      </section>
    </div>
  </AppLayout>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { AlertCircle, ArrowRight, Bot, CheckCircle2, Download, Eye, GitBranch, Layers3, LoaderCircle, Plus, Search, ShieldCheck, Sparkles } from "lucide-vue-next";
import AppLayout from "../layouts/AppLayout.vue";
import { apiFetch, readApiError } from "../api/client";

const router=useRouter(),summary=ref(null),loading=ref(true),error=ref("");
const entries=[{to:"/studio/dx-discovery",number:"01",eyebrow:"DEFINE",title:"업무 과제 구체화",description:"Agent와 대화하며 현장의 문제를 실행 가능한 DX 과제로 구체화합니다.",action:"DX 과제 발굴로 이동",icon:Sparkles},{to:"/studio/assets",number:"02",eyebrow:"REUSE",title:"검증 자산 탐색·확산",description:"승인된 운영 자산의 코드, Skill과 실제 적용 경험을 확인합니다.",action:"AI 자산 탐색으로 이동",icon:Search},{to:"/studio/assets/register",number:"03",eyebrow:"SHARE",title:"완성 자산 등록·공유",description:"코드·데이터·활용 화면을 재사용 가능한 자산으로 등록합니다.",action:"AI 자산 등록으로 이동",icon:Plus}];
const values=[{label:"발굴",title:"막연한 문제를 과제로",description:"대화를 통해 업무 방식과 Pain Point를 정리하고 과제 정의서로 구체화합니다.",icon:Sparkles},{label:"등록",title:"검증 가능한 자산화",description:"명세, 저장소, 데이터와 성능을 함께 관리해 신뢰할 수 있는 자산을 만듭니다.",icon:ShieldCheck},{label:"탐색",title:"필요한 자산을 빠르게",description:"업무 영역, Task, 구현 방식과 데이터 유형을 기준으로 운영 자산을 탐색합니다.",icon:Layers3},{label:"확산",title:"적용 경험까지 축적",description:"Skill과 저장소를 활용하고 실제 적용 사례와 Q&A를 다시 공유합니다.",icon:GitBranch}];
const process=[{title:"과제 발굴",description:"업무 문제와 기대 효과를 정의합니다."},{title:"등록·심사",description:"자산을 명세화하고 거버넌스 검토를 거칩니다."},{title:"탐색·확산 시도",description:"적합한 자산의 코드와 Skill을 적용합니다."},{title:"적용·사례 공유",description:"성과와 수정 방식을 공유합니다."}];
const maxActivity=computed(()=>Math.max(1,...(summary.value?.monthly_activity||[]).flatMap(item=>[item.registrations,item.downloads]))),maxArea=computed(()=>Math.max(1,...(summary.value?.business_distribution||[]).map(item=>item.count)));
const kpis=computed(()=>summary.value?[{label:"운영 자산",value:summary.value.totals.asset_count,icon:Bot},{label:"누적 조회 수",value:summary.value.totals.view_count,icon:Eye},{label:"누적 다운로드 수",value:summary.value.totals.diffusion_attempt_count,icon:Download},{label:"확산 완료",value:summary.value.totals.diffusion_completed_count,icon:CheckCircle2}]:[]);
const number=value=>Number(value||0).toLocaleString(),barHeight=value=>`${Math.max(4,Number(value||0)/maxActivity.value*100)}%`,areaWidth=value=>`${Number(value||0)/maxArea.value*100}%`;
async function loadSummary(){loading.value=true;error.value="";try{const response=await apiFetch("/api/assets/intro/summary");if(!response.ok)throw await readApiError(response,"운영 현황을 불러오지 못했습니다.");summary.value=await response.json();}catch(e){error.value=e.message;}finally{loading.value=false;}}
const openAsset=assetId=>router.push({name:"asset-catalog",query:{asset:assetId}});onMounted(loadSummary);
</script>
