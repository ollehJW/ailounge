<template>
  <div :class="['ai-lounge-scope', 'ai-lounge-app', { 'ai-lounge-app-embedded': isEmbeddedPage }]">
    <RouterView v-slot="{ Component, route: currentRoute }">
      <AppLayout v-if="currentRoute.meta.layout !== false && !isEmbeddedLayout">
        <component :is="Component" />
      </AppLayout>
      <EmbeddedLayout v-else-if="currentRoute.meta.layout !== false">
        <component :is="Component" />
      </EmbeddedLayout>
      <component :is="Component" v-else />
    </RouterView>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppLayout from "./layouts/PortalAppLayout.vue";
import EmbeddedLayout from "./layouts/EmbeddedLayout.vue";
import { IS_EMBEDDED_LAYOUT } from "./config/runtime";

const route = useRoute();
const isEmbeddedLayout = IS_EMBEDDED_LAYOUT;
const isEmbeddedPage = computed(() => isEmbeddedLayout && route.meta.layout !== false);

</script>
