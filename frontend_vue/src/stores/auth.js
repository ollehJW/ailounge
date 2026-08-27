import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { apiFetch } from "../api/client";

const DEMO_USER = {
  user_id: "33502",
  login_id: "33502",
  email: "jongwook.lee@hyundai-wia.com",
  org_name: "DX추진랩",
  displayed_name: "이종욱",
  job_title: "",
  is_admin: true,
  created_at: "",
};

export const useAuthStore = defineStore("auth", () => {
  const token = ref("demo");
  const user = ref({ ...DEMO_USER });
  const initialized = ref(false);
  const isAuthenticated = computed(() => true);

  const initializeDemo = async () => {
    if (initialized.value) return;
    try {
      const response = await apiFetch("/api/auth/me", {
        headers: { Authorization: "Bearer demo" },
      });
      if (response.ok) user.value = { ...(await response.json()), is_admin: false };
    } catch {
      user.value = { ...DEMO_USER };
    } finally {
      initialized.value = true;
    }
  };

  const hydrateFromStorage = initializeDemo;
  const logout = () => {};

  return {
    token,
    user,
    initialized,
    isAuthenticated,
    initializeDemo,
    hydrateFromStorage,
    logout,
  };
});
