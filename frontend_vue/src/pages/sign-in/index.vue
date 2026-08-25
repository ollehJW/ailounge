<template>
  <main class="login-page">
    <section class="login-visual">
      <div class="login-grid"></div>
      <div class="login-brand">
        <span class="login-brand-mark">WIA</span>
        <p>AI LOUNGE</p>
      </div>
      <div class="login-message">
        <span>CONNECT · SHARE · DIFFUSE</span>
        <h1>AI 자산과 경험이<br />조직의 역량이 되는 곳</h1>
        <p>업무 현장의 AI 활용 경험과 검증된 자산을 한 곳에서 연결합니다.</p>
      </div>
      <div class="login-status"><i></i><span>WIA INTERNAL SERVICE</span></div>
    </section>
    <section class="login-form-side">
      <form class="login-form" @submit.prevent="submitLogin">
        <header><span>WELCOME BACK</span><h2>AI Lounge 로그인</h2><p>사번과 비밀번호를 입력해 주세요.</p></header>
        <label><span>사번</span><div class="login-input"><BadgeCheck :size="18" /><input v-model="loginId" autocomplete="username" placeholder="사번을 입력하세요" required /></div></label>
        <label><span>비밀번호</span><div class="login-input"><LockKeyhole :size="18" /><input v-model="password" type="password" autocomplete="current-password" placeholder="비밀번호를 입력하세요" required /></div></label>
        <p v-if="error" class="form-error">{{ error }}</p>
        <button class="primary-button login-submit" type="submit" :disabled="submitting"><span>{{ submitting ? "로그인 중..." : "로그인" }}</span><ArrowRight :size="18" /></button>
      </form>
    </section>
  </main>
</template>

<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowRight, BadgeCheck, LockKeyhole } from "@/icons/lucide";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore(); const router = useRouter(); const route = useRoute();
const loginId = ref(""); const password = ref(""); const error = ref(""); const submitting = ref(false);
const submitLogin = async () => {
  error.value = ""; submitting.value = true;
  try { await auth.login(loginId.value, password.value); await router.replace(String(route.query.redirect || "/community/tech-news")); }
  catch (loginError) { error.value = loginError.message; }
  finally { submitting.value = false; }
};
</script>

