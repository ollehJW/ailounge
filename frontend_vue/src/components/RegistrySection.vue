<template>
  <section class="registry-section" :class="complete ? 'complete' : 'incomplete'">
    <header><h3>{{ title }}</h3><span :title="complete ? '작성 완료' : '작성 필요'" :aria-label="complete ? '작성 완료' : '작성 필요'"><Check v-if="complete" :size="14" /><X v-else :size="14" /></span></header>
    <div><slot /></div>
  </section>
</template>
<script setup>
import { Check, X } from "@/icons/lucide";
defineProps({ title: String, complete: Boolean });
</script>
