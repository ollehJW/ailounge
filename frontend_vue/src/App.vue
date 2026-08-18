<template>
  <RouterView />
</template>

<script setup>
import { onBeforeUnmount, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "./stores/auth";

const router = useRouter();
const auth = useAuthStore();

const handleAuthExpired = () => {
  auth.logout();
  router.replace({ name: "login" });
};

onMounted(() => window.addEventListener("ailounge:auth-expired", handleAuthExpired));
onBeforeUnmount(() => window.removeEventListener("ailounge:auth-expired", handleAuthExpired));
</script>
