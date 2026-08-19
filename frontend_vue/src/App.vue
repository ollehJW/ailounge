<template>
  <div class="ai-lounge-scope ai-lounge-app">
    <RouterView v-slot="{ Component, route: currentRoute }">
      <AppLayout v-if="currentRoute.meta.layout !== false">
        <component :is="Component" />
      </AppLayout>
      <component :is="Component" v-else />
    </RouterView>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted } from "vue";
import { useRouter } from "vue-router";
import AppLayout from "./layouts/AppLayout.vue";
import { useAuthStore } from "./stores/auth";
import { AUTH_EXPIRED_EVENT } from "./config/runtime";

const router = useRouter();
const auth = useAuthStore();

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
