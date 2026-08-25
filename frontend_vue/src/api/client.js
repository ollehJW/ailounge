import { API_BASE, AUTH_EXPIRED_EVENT, AUTH_STORAGE_KEYS } from "../config/runtime";
import { dispatchBrowserEvent, getLocalStorage } from "../utils/browser";

export { API_BASE };

export const resolveApiUrl = (path) => {
  if (!path || /^https?:\/\//.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
};

export const resolveApiHtml = (html) => String(html || "").replace(
  /\b(src|href)=(["'])(\/api(?:\/[^"']*)?)\2/gi,
  (_, attribute, quote, path) => `${attribute}=${quote}${resolveApiUrl(path)}${quote}`,
);

export const normalizeApiHtml = (html) => {
  if (!API_BASE) return String(html || "");
  const escapedBase = API_BASE.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");
  return String(html || "").replace(
    new RegExp(`\\b(src|href)=(["'])${escapedBase}(/api(?:/[^"']*)?)\\2`, "gi"),
    (_, attribute, quote, path) => `${attribute}=${quote}${path}${quote}`,
  );
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
