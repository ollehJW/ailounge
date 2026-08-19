import { API_BASE, API_PATH_PREFIX, AUTH_EXPIRED_EVENT, AUTH_STORAGE_KEYS } from "../config/runtime";
import { dispatchBrowserEvent, getLocalStorage } from "../utils/browser";

export { API_BASE };

export const resolveApiUrl = (path) => {
  if (!path || /^https?:\/\//.test(path)) return path;
  const apiPath = path === "/api" || path.startsWith("/api/")
    ? `${API_PATH_PREFIX}${path.slice(4)}`
    : path;
  return `${API_BASE}${apiPath}`;
};

export const readApiError = async (response, fallback) => {
  const data = await response.json().catch(() => ({}));
  return new Error(data.detail || fallback);
};

export const apiFetch = async (path, options = {}) => {
  const storage = getLocalStorage();
  const token = storage?.getItem(AUTH_STORAGE_KEYS.token) || "";
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(resolveApiUrl(path), { ...options, headers });
  if (response.status === 401 && token) {
    storage?.removeItem(AUTH_STORAGE_KEYS.token);
    storage?.removeItem(AUTH_STORAGE_KEYS.user);
    dispatchBrowserEvent(AUTH_EXPIRED_EVENT);
  }
  return response;
};
