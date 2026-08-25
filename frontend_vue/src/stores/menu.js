import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { apiFetch, readApiError } from "../api/client";
import { buildNavigationSections, fallbackNavigationSections } from "../config/navigation-db";
import { useAuthStore } from "./auth";

const collectPaths = (items, paths = new Set()) => {
  for (const item of items || []) {
    if (item.menu_path) paths.add(item.menu_path.replace(/\/$/, "") || "/");
    collectPaths(item.child, paths);
  }
  return paths;
};

export const useMenuStore = defineStore("menu", () => {
  const roleMenu = ref([]);
  const loaded = ref(false);
  const loadedUserId = ref("");
  const loadError = ref("");

  const sections = computed(() => {
    if (roleMenu.value.length) return buildNavigationSections(roleMenu.value);
    const auth = useAuthStore();
    return fallbackNavigationSections(Boolean(auth.user?.is_admin));
  });
  const allowedPaths = computed(() => collectPaths(roleMenu.value));

  const load = async (force = false) => {
    const auth = useAuthStore();
    if (loaded.value && loadedUserId.value === auth.user?.user_id && !force) return;
    try {
      const response = await apiFetch("/api/menu");
      if (!response.ok) throw await readApiError(response, "메뉴를 불러오지 못했습니다.");
      const payload = await response.json();
      roleMenu.value = payload?.data?.[0]?.roleMenuList || [];
      loadedUserId.value = auth.user?.user_id || "";
      loadError.value = "";
    } catch (error) {
      roleMenu.value = [];
      loadedUserId.value = "";
      loadError.value = error instanceof Error ? error.message : "메뉴를 불러오지 못했습니다.";
    } finally {
      loaded.value = true;
    }
  };

  const canAccess = (path) => {
    if (!roleMenu.value.length) return false;
    return allowedPaths.value.has(path.replace(/\/$/, "") || "/");
  };

  const clear = () => {
    roleMenu.value = [];
    loaded.value = false;
    loadedUserId.value = "";
    loadError.value = "";
  };

  return { roleMenu, loaded, loadError, sections, load, canAccess, clear };
});
