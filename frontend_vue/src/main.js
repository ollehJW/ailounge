import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import { useAuthStore } from "./stores/auth";
import { ROUTER_BASE } from "./config/runtime";
import "./styles/tokens.css";
import "./styles/isolation.css";
import "./styles.css";
import "./styles/community.css";
import "./styles/forms.css";
import "./styles/idea-process.css";
import "./styles/idea-popup.css";
import "./styles/news-popup.css";
import "./styles/studio.css";
import "./styles/dx-discovery.css";
import "./styles/asset-recommendation.css";
import "./styles/asset-catalog.css";
import "./styles/asset-qa.css";
import "./styles/asset-detail.css";
import "./styles/registry.css";
import "./styles/administration.css";
import "./styles/connected-services.css";

const PAGE_META = {
  "/sign-in": { public: true, layout: false },
  "/aistudio": { section: "studio", sectionLabel: "AI STUDIO", title: "AI STUDIO 소개", description: "업무 과제 발굴부터 검증된 AI 자산의 등록·탐색·확산까지 하나의 흐름으로 연결합니다." },
  "/aistudio/dx-discovery": { section: "studio", sectionLabel: "AI STUDIO", title: "DX 과제 발굴", description: "AI Agent와 대화하여 업무 문제를 실행 가능한 DX 과제로 구체화합니다." },
  "/aistudio/assets": { section: "studio", sectionLabel: "AI STUDIO", title: "AI 자산 라이브러리", description: "검증된 AI 모델, Agent와 업무 자동화 자산을 탐색하고 업무에 맞게 확산합니다." },
  "/aistudio/assets/register": { section: "studio", sectionLabel: "AI STUDIO", title: "AI 자산 등록", description: "개발 완료한 AI 자산을 전사에서 재사용할 수 있는 형태로 등록합니다." },
  "/community/tech-news": { section: "community", sectionLabel: "AX COMMUNITY", title: "AI Tech News", description: "위아 소식과 외부 AI 동향, 업무 혁신 BP 사례를 확인합니다." },
  "/community/ai-usage": { section: "community", sectionLabel: "AX COMMUNITY", title: "나만의 AI 활용법", description: "업무에서 실제로 써본 AI 활용 경험과 시행착오를 함께 공유합니다." },
  "/community/ideas": { section: "community", sectionLabel: "AX COMMUNITY", title: "AI 아이디어 공모", description: "업무 현장의 문제와 AI 적용 아이디어를 DX추진랩에 제안합니다." },
  "/connected/calendar": { section: "connected", sectionLabel: "연계 서비스", title: "AI Calendar", description: "AI 학회·세미나 및 주요 일정을 한눈에 확인합니다." },
  "/administration/ideas": { section: "administration", sectionLabel: "MANAGEMENT", title: "Idea 심사", description: "접수된 AI 아이디어를 검토하고 심사 결과와 의견을 관리합니다." },
  "/administration/assets": { section: "administration", sectionLabel: "MANAGEMENT", title: "AI 자산 관리", description: "자산 등록 요청을 심사하고 승인된 운영 자산의 상태를 관리합니다." },
  "/administration/tech-news": { section: "administration", sectionLabel: "MANAGEMENT", title: "Tech News 관리", description: "AI Tech News 콘텐츠를 작성하고 발행된 게시물을 관리합니다." },
};

const pageModules = import.meta.glob("./pages/**/*.vue");
const fileRoutes = Object.entries(pageModules).map(([file, component]) => {
  const relativePath = file
    .replace(/^\.\/pages/, "")
    .replace(/\.vue$/, "")
    .replace(/\/index$/, "");
  const path = relativePath || "/";
  return { path, component, meta: PAGE_META[path] || {} };
});

const router = createRouter({
  history: createWebHistory(ROUTER_BASE),
  routes: [
    { path: "/", redirect: "/aistudio" },
    { path: "/administration", redirect: "/administration/ideas" },
    ...fileRoutes,
    { path: "/:pathMatch(.*)*", redirect: "/aistudio" },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.isAuthenticated) {
    return { path: "/sign-in", query: { redirect: to.fullPath } };
  }
  if (to.path === "/sign-in" && auth.isAuthenticated) return "/aistudio";
});

createApp(App).use(createPinia()).use(router).mount("#app");
