<template><section class="repo-tree"><header><FolderGit2 :size="17" /><strong>저장소 파일 구조</strong></header><ul><RepoTreeNode v-for="item in items" :key="item.path" :item="item" /></ul></section></template>
<script setup>import{FolderGit2}from"lucide-vue-next";import RepoTreeNode from"./RepoTreeNode.vue";defineProps({items:Array});</script>
