import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { NAV_SECTIONS } from "../config/navigation";
import { useAuthStore } from "./auth";

const toPortalMenu = (sections) => sections.map((section) => ({
  menu_id: section.id,
  menu_name: section.label,
  menu_desc: section.description,
  menu_path: section.home,
  menu_visible: true,
  child: [{
    menu_id: `${section.id}_group`,
    menu_name: section.heading,
    menu_desc: section.description,
    menu_visible: true,
    child: section.items.map((item) => ({
      menu_id: `${section.id}_${item.to}`,
      menu_name: item.label,
      menu_desc: item.description,
      menu_path: item.to,
      menu_visible: true,
      child: [],
    })),
  }],
}));

export const useMenuStore = defineStore("menu", () => {
  const loaded = ref(false);
  const loadError = ref("");
  const auth = useAuthStore();
  const sections = computed(() => (
    auth.user?.is_admin
      ? NAV_SECTIONS
      : NAV_SECTIONS.filter((section) => section.id !== "administration")
  ));
  const roleMenu = computed(() => toPortalMenu(sections.value));
  const allowedPaths = computed(() => new Set(
    sections.value.flatMap((section) => section.items.map((item) => item.to)),
  ));

  const load = async () => {
    loaded.value = true;
    loadError.value = "";
  };
  const canAccess = (path) => allowedPaths.value.has(path.replace(/\/$/, "") || "/");
  const clear = () => {};

  return { roleMenu, loaded, loadError, sections, load, canAccess, clear };
});
