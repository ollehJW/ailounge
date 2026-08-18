<template><section class="registry-section"><header><h3>{{ title }}</h3><span :class="{complete}"><Check v-if="complete" :size="14" /><X v-else :size="14" />{{ complete?'작성 완료':'작성 필요' }}</span></header><div><slot /></div></section></template>
<script setup>import{Check,X}from"lucide-vue-next";defineProps({title:String,complete:Boolean});</script>
