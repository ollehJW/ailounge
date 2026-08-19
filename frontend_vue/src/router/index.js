import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";
import LoginPage from "../pages/LoginPage.vue";
import TechNewsPage from "../pages/TechNewsPage.vue";
import AiUsagePage from "../pages/AiUsagePage.vue";
import IdeasPage from "../pages/IdeasPage.vue";
import StudioIntroPage from "../pages/StudioIntroPage.vue";
import DxDiscoveryPage from "../pages/DxDiscoveryPage.vue";
import AssetCatalogPage from "../pages/AssetCatalogPage.vue";
import AssetRegistryPage from "../pages/AssetRegistryPage.vue";
import { ROUTER_BASE } from "../config/runtime";

const router = createRouter({
  // TODO(portal-integration): Portal 라우팅으로 이관한 뒤 독립 Vue Router를 제거한다.
  history: createWebHistory(ROUTER_BASE),
  routes: [
    { path: "/login", name: "login", component: LoginPage, meta: { public: true, layout: false } },
    { path: "/", redirect: "/studio" },
    { path: "/studio", name: "studio-intro", component: StudioIntroPage, meta: { section: "studio", sectionLabel: "AI STUDIO", title: "AI STUDIO 소개", description: "업무 과제 발굴부터 검증된 AI 자산의 등록·탐색·확산까지 하나의 흐름으로 연결합니다." } },
    { path: "/studio/dx-discovery", name: "dx-discovery", component: DxDiscoveryPage, meta: { section: "studio", sectionLabel: "AI STUDIO", title: "DX 과제 발굴", description: "AI Agent와 대화하여 업무 문제를 실행 가능한 DX 과제로 구체화합니다." } },
    { path: "/studio/assets", name: "asset-catalog", component: AssetCatalogPage, meta: { section: "studio", sectionLabel: "AI STUDIO", title: "AI 자산 라이브러리", description: "검증된 AI 모델, Agent와 업무 자동화 자산을 탐색하고 업무에 맞게 확산합니다." } },
    { path: "/studio/assets/register", name: "asset-registry", component: AssetRegistryPage, meta: { section: "studio", sectionLabel: "AI STUDIO", title: "AI 자산 등록", description: "개발 완료한 AI 자산을 전사에서 재사용할 수 있는 형태로 등록합니다." } },
    { path: "/community/tech-news", name: "tech-news", component: TechNewsPage, meta: { section: "community", sectionLabel: "AX COMMUNITY", title: "AI Tech News", description: "위아 소식과 외부 AI 동향, 업무 혁신 BP 사례를 확인합니다." } },
    { path: "/community/ai-usage", name: "ai-usage", component: AiUsagePage, meta: { section: "community", sectionLabel: "AX COMMUNITY", title: "나만의 AI 활용법", description: "업무에서 실제로 써본 AI 활용 경험과 시행착오를 함께 공유합니다." } },
    { path: "/community/ideas", name: "ideas", component: IdeasPage, meta: { section: "community", sectionLabel: "AX COMMUNITY", title: "AI 아이디어 공모", description: "업무 현장의 문제와 AI 적용 아이디어를 DX추진랩에 제안합니다." } },
    { path: "/:pathMatch(.*)*", redirect: "/studio" }
  ],
  scrollBehavior: () => ({ top: 0 })
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.isAuthenticated) return { name: "login", query: { redirect: to.fullPath } };
  if (to.name === "login" && auth.isAuthenticated) return { name: "studio-intro" };
});

export default router;
