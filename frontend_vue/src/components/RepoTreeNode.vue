<template><li><span><Folder v-if="item.type==='directory'" :size="14" /><FileCode2 v-else :size="14" />{{ item.name }}</span><ul v-if="item.children?.length"><RepoTreeNode v-for="child in item.children" :key="child.path" :item="child" /></ul></li></template>
<script setup>import{FileCode2,Folder}from"lucide-vue-next";defineOptions({name:"RepoTreeNode"});defineProps({item:Object});</script>
