import { NAV_SECTIONS } from "./navigation";

const SECTION_PRESENTATION = {
  U_AI_STUDIO: { id: "studio", heading: "검증된 AI를 실행력으로" },
  U_AX_COMMUNITY: { id: "community", heading: "함께 나누는 AI 경험" },
  A_AI_MANAGEMENT: { id: "administration", heading: "AI 서비스 운영 관리" },
};

const ITEM_EYEBROWS = {
  "/aistudio/intro": "OVERVIEW",
  "/aistudio/dx-discovery": "DEFINE",
  "/aistudio/assets/explore": "REUSE",
  "/aistudio/assets/register": "SHARE",
  "/community/tech-news": "NEWS",
  "/community/calendar": "CALENDAR",
  "/community/ai-usage": "PRACTICE",
  "/community/ideas": "IDEA",
  "/administration/ideas": "REVIEW",
  "/administration/assets": "ASSET",
  "/administration/tech-news": "CONTENT",
};

const collectPageMenus = (menu, pages = []) => {
  const visibleChildren = (menu.child || []).filter((child) => child.menu_visible !== false);
  if (!visibleChildren.length && menu.menu_path) pages.push(menu);
  for (const child of visibleChildren) collectPageMenus(child, pages);
  return pages;
};

export const buildNavigationSections = (roleMenuList) => (roleMenuList || [])
  .filter((menu) => menu.menu_visible !== false)
  .map((menu) => {
    const presentation = SECTION_PRESENTATION[menu.menu_id] || {};
    const items = collectPageMenus(menu).map((item) => ({
      to: item.menu_path,
      eyebrow: ITEM_EYEBROWS[item.menu_path] || "MENU",
      label: item.menu_name,
      description: item.menu_desc,
    }));
    return {
      id: presentation.id || menu.menu_id.toLowerCase(),
      label: menu.menu_name,
      home: menu.menu_path || items[0]?.to || "/aistudio/intro",
      heading: presentation.heading || menu.menu_name,
      description: menu.menu_desc,
      items,
    };
  });

export const fallbackNavigationSections = (isAdmin) => (
  isAdmin ? NAV_SECTIONS : NAV_SECTIONS.filter((section) => section.id !== "administration")
);
