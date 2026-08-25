<template>
  <section class="item-editor">
    <h4>{{ title }} *</h4>
    <article v-for="(item,index) in items" :key="index">
      <header><span>{{ noteLabel }} Note {{ index+1 }}</span><button v-if="items.length>1" type="button" @click="$emit('remove',index)">삭제</button></header>
      <input v-model="item[nameKey]" :placeholder="namePlaceholder" />
      <input v-model="item.description" :placeholder="descriptionPlaceholder" />
      <input v-model="item.reference_url" placeholder="참조 URL (선택)" />
    </article>
    <button class="item-add-button" type="button" @click="$emit('add')"><Plus :size="15" />{{ addLabel }}</button>
  </section>
</template>
<script setup>
import { computed } from "vue";
import { Plus } from "@/icons/lucide";
const props=defineProps({title:String,items:Array,nameKey:String,namePlaceholder:String});
defineEmits(["add","remove"]);
const noteLabel=computed(()=>props.nameKey==="model_name"?"Model":"Stack");
const addLabel=computed(()=>props.nameKey==="model_name"?"모델 추가":"스택 추가");
const descriptionPlaceholder=computed(()=>props.nameKey==="model_name"?"설명 (예: 센서 피처 기반 불량 확률 예측 모델)":"용도 설명 (예: 이미지 모델 학습 및 추론)");
</script>
