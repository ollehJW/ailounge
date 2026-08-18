<template>
  <div class="guided-field">
    <div class="guided-field-label"><span>{{ label }} *</span><button type="button" :aria-label="`${label} 작성 예시 보기`" @click="open=!open">?</button></div>
    <textarea v-model="model" rows="3" :placeholder="guide"></textarea>
    <div v-if="open" class="field-guide">{{ guide }}</div>
  </div>
</template>
<script setup>
import { ref } from "vue";
defineProps({label:String,guide:String});
const model=defineModel({type:String,default:""}),open=ref(false);
</script>
