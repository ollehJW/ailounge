import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { apiFetch, readApiError } from "../api/client";

const readStoredUser = () => {
  try {
    return JSON.parse(window.localStorage.getItem("ailounge_user") || "null");
  } catch {
    return null;
  }
};

export const useAuthStore = defineStore("auth", () => {
  const token = ref(window.localStorage.getItem("ailounge_token") || "");
  const user = ref(readStoredUser());
  const isAuthenticated = computed(() => Boolean(token.value && user.value));

  const login = async (loginId, password) => {
    const response = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login_id: loginId.trim(), password })
    });
    if (!response.ok) throw await readApiError(response, "로그인에 실패했습니다.");
    const data = await response.json();
    token.value = data.access_token;
    user.value = data.user;
    window.localStorage.setItem("ailounge_token", data.access_token);
    window.localStorage.setItem("ailounge_user", JSON.stringify(data.user));
  };

  const logout = () => {
    token.value = "";
    user.value = null;
    window.localStorage.removeItem("ailounge_token");
    window.localStorage.removeItem("ailounge_user");
  };

  return { token, user, isAuthenticated, login, logout };
});
