<template>
  <div class="portal-shell">
    <header class="portal-header">
      <div class="portal-header-inner">
        <RouterLink class="portal-brand" to="/studio" aria-label="WIA AI Lounge 홈">
          <img src="../assets/logo-header.png" alt="WIA" />
        </RouterLink>
        <nav class="portal-nav" aria-label="주 메뉴">
          <div v-for="section in navSections" :key="section.id" class="portal-nav-root">
            <RouterLink :to="section.home" :class="['portal-nav-trigger', { active: route.meta.section === section.id }]">{{ section.label }}</RouterLink>
            <div class="portal-submenu">
              <div class="portal-submenu-inner">
                <div class="portal-submenu-summary">
                  <span>{{ section.label }}</span>
                  <strong>{{ section.heading }}</strong>
                  <p>{{ section.description }}</p>
                </div>
                <div class="portal-submenu-links">
                  <RouterLink v-for="item in section.items" :key="item.to" :to="item.to"><span>{{ item.eyebrow }}</span><strong>{{ item.label }}</strong><p>{{ item.description }}</p></RouterLink>
                </div>
              </div>
            </div>
          </div>
        </nav>
        <div class="portal-account">
          <span class="portal-user-avatar" aria-hidden="true"></span>
          <strong>{{ auth.user?.displayed_name }} {{ auth.user?.job_title }} 님</strong>
          <button type="button" class="icon-button" title="로그아웃" aria-label="로그아웃" @click="handleLogout">
            <LogOut :size="18" />
          </button>
        </div>
      </div>
    </header>

    <main class="portal-main">
      <div class="portal-contents-top">
        <nav class="portal-breadcrumbs" aria-label="현재 위치">
          <ol>
            <li><RouterLink to="/studio" aria-label="홈"><House :size="17" /></RouterLink></li>
            <li><ChevronRight :size="14" /><span>{{ route.meta.sectionLabel }}</span></li>
            <li><ChevronRight :size="14" /><strong>{{ route.meta.title }}</strong></li>
          </ol>
        </nav>
        <section v-if="route.name !== 'studio-intro'" :class="['page-heading-band', 'section-' + (route.meta.section || 'community')]">
          <div class="page-heading-inner">
            <h1>{{ route.meta.title }}</h1>
            <p>{{ route.meta.description }}</p>
          </div>
        </section>
      </div>
      <div class="portal-content"><slot /></div>
    </main>

    <footer class="portal-footer">
      <div class="portal-footer-inner">
        <img src="../assets/logo-footer.png" alt="HYUNDAI WIA" />
        <p>COPYRIGHT &copy; HYUNDAI WIA CORP. ALL RIGHTS RESERVED.</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ChevronRight, House, LogOut } from "lucide-vue-next";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const navSections = [
  {
    id: "studio", label: "AI STUDIO", home: "/studio", heading: "검증된 AI를 실행력으로", description: "과제를 발굴하고 완성된 AI 자산을 등록·탐색·확산합니다.",
    items: [
      { to: "/studio", eyebrow: "OVERVIEW", label: "소개", description: "AI STUDIO의 역할과 운영 현황" },
      { to: "/studio/dx-discovery", eyebrow: "DEFINE", label: "DX 과제 발굴", description: "Agent와 대화하며 업무 과제 구체화" },
      { to: "/studio/assets", eyebrow: "REUSE", label: "AI 자산 라이브러리", description: "검증된 자산 탐색과 현업 확산" },
      { to: "/studio/assets/register", eyebrow: "SHARE", label: "AI 자산 등록", description: "완성 자산 등록과 확산 패키지 생성" },
    ],
  },
  {
    id: "community", label: "AX COMMUNITY", home: "/community/tech-news", heading: "함께 나누는 AI 경험", description: "AI 소식과 업무 활용 경험, 새로운 아이디어를 공유합니다.",
    items: [
      { to: "/community/tech-news", eyebrow: "NEWS", label: "AI Tech News", description: "위아 소식과 외부 AI 동향, BP 사례" },
      { to: "/community/ai-usage", eyebrow: "PRACTICE", label: "나만의 AI 활용법", description: "업무에서 직접 시도한 경험과 교훈" },
      { to: "/community/ideas", eyebrow: "IDEA", label: "AI 아이디어 공모", description: "현장의 문제와 AI 적용 아이디어 제안" },
    ],
  },
];

const handleLogout = () => {
  auth.logout();
  router.replace({ name: "login" });
};
</script>
