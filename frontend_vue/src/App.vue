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
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppLayout from "./layouts/AppLayout.vue";
import EmbeddedLayout from "./layouts/EmbeddedLayout.vue";
import { useAuthStore } from "./stores/auth";
import { AUTH_EXPIRED_EVENT, IS_EMBEDDED_LAYOUT } from "./config/runtime";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const isEmbeddedLayout = IS_EMBEDDED_LAYOUT;
const isEmbeddedPage = computed(() => isEmbeddedLayout && route.meta.layout !== false);

const handleAuthExpired = () => {
  auth.logout();
  router.replace({ name: "login" });
};

onMounted(() => {
  auth.hydrateFromStorage();
  window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
});
onBeforeUnmount(() => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired));
</script>
