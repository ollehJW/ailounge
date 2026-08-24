import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { apiFetch, readApiError } from "../api/client";
import { AUTH_STORAGE_KEYS } from "../config/runtime";
import { getLocalStorage } from "../utils/browser";

const readStoredUser = () => {
  try {
    return JSON.parse(getLocalStorage()?.getItem(AUTH_STORAGE_KEYS.user) || "null");
  } catch {
    return null;
  }
};

export const useAuthStore = defineStore("auth", () => {
  const token = ref(getLocalStorage()?.getItem(AUTH_STORAGE_KEYS.token) || "");
  const user = ref(readStoredUser());
  const isAuthenticated = computed(() => Boolean(token.value && user.value));

  const hydrateFromStorage = () => {
    const storage = getLocalStorage();
    token.value = storage?.getItem(AUTH_STORAGE_KEYS.token) || "";
    user.value = readStoredUser();
  };

  const encodeBasicCredentials = (loginId, password) => {
    const bytes = new TextEncoder().encode(`${loginId}:${password}`);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return btoa(binary);
  };

  const login = async (loginId, password) => {
    const response = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${encodeBasicCredentials(loginId.trim(), password)}`
      }
    });
    if (!response.ok) throw await readApiError(response, "로그인에 실패했습니다.");
    const data = await response.json();
    token.value = data.access_token;
    user.value = data.user;
    const storage = getLocalStorage();
    storage?.setItem(AUTH_STORAGE_KEYS.token, data.access_token);
    storage?.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(data.user));
  };

  const logout = () => {
    token.value = "";
    user.value = null;
    const storage = getLocalStorage();
    storage?.removeItem(AUTH_STORAGE_KEYS.token);
    storage?.removeItem(AUTH_STORAGE_KEYS.user);
  };

  return { token, user, isAuthenticated, hydrateFromStorage, login, logout };
});
