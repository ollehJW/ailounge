<template>
  <section class="item-editor metric-editor">
    <h4>{{ title }} * <small>{{ hint }}</small></h4>
    <article v-for="(item,index) in items" :key="index">
      <div v-if="type==='comparison'" class="metric-fields"><input v-model="item.metric_name" placeholder="측정 항목 (예: 처리시간)" /><input v-model="item.before_value" placeholder="이전 값 (예: 4시간)" /><input v-model="item.after_value" placeholder="이후 값 (예: 1시간)" /><input v-model="item.improvement_rate" placeholder="개선율 (예: 75%)" /></div>
      <div v-else class="metric-fields kpi"><input v-model="item.metric_name" placeholder="지표명 (예: 정확도)" /><input v-model="item.value" placeholder="값 (예: 94.2%)" /><input v-model="item.description" placeholder="설명 (예: 검증 데이터 기준)" /></div>
      <button v-if="items.length>1" type="button" @click="$emit('remove',index)">삭제</button>
    </article>
    <button class="item-add-button" type="button" @click="$emit('add')"><Plus :size="15" />{{ type==='comparison'?'항목 추가':'지표 추가' }}</button>
  </section>
</template>
<script setup>
import { computed } from "vue";
import { Plus } from "lucide-vue-next";
const props=defineProps({title:String,items:Array,type:String});
defineEmits(["add","remove"]);
const hint=computed(()=>props.type==="comparison"?"(예: 처리시간, 수작업 시간, 오류 건수)":"(예: 정확도, F1-score, 응답시간)");
</script>
