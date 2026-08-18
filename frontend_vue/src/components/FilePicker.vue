<template>
  <label class="file-picker-reg">
    <input type="file" @change="change" />
    <small class="file-picker-action">파일 선택</small>
    <b>{{ label }}</b>
    <span>{{ file?.name || "CSV · Parquet · XLSX · JSON · ZIP · 파일 1개 · 최대 10MB" }}</span>
    <em>여러 데이터는 ZIP으로 묶어 업로드하세요.</em>
  </label>
</template>
<script setup>
defineProps({label:String,file:Object});
const emit=defineEmits(["change"]);
function change(event){emit("change",event.target.files?.[0]||null);event.target.value="";}
</script>
