<template>
  <article class="asset-catalog-card" tabindex="0" role="button" @click="$emit('open',asset)" @keydown.enter="$emit('open',asset)">
    <div class="asset-card-top"><span :class="['asset-maturity',asset.maturity_level]">{{ asset.maturity_level }}</span><button type="button" :class="{active:asset.is_bookmarked}" :aria-label="asset.is_bookmarked?'내 컬렉션에서 제거':'내 컬렉션에 저장'" @click.stop="$emit('bookmark',asset)"><Star :size="16" :fill="asset.is_bookmarked?'currentColor':'none'" /></button></div>
    <div class="asset-card-title"><small>{{ asset.business_area }}</small><h2>{{ asset.asset_name }}</h2><p>{{ asset.description }}</p></div>
    <dl><div><dt>Task 유형</dt><dd>{{ joined(asset.task_types) }}</dd></div><div><dt>구현 방식</dt><dd>{{ joined(asset.implementation_types) }}</dd></div><div><dt>Data 유형</dt><dd>{{ asset.data_type||'데이터 없음' }}</dd></div></dl>
    <div class="asset-card-tags"><span v-for="tag in (asset.tags||[]).slice(0,4)" :key="tag">#{{ tag }}</span></div>
    <footer><span class="asset-card-foot-stats"><em title="조회 수"><Eye :size="11" />{{ number(asset.view_count) }}</em><i></i><span><b>{{ number(asset.diffusion_completed_count) }}</b>회 확산 완료 / <b>{{ number(asset.diffusion_attempt_count) }}</b>회 확산 시도</span></span><button type="button">보기 <ArrowRight :size="13" /></button></footer>
  </article>
</template>
<script setup>
import { ArrowRight,Eye,Star } from "@/icons/lucide";
defineProps({asset:{type:Object,required:true}});defineEmits(["open","bookmark"]);
const joined=items=>(items||[]).join(" · ")||"미분류";const number=value=>Number(value||0).toLocaleString();
</script>
