const trimTrailingSlash = (value) => value.replace(/\/+$/, "");
const normalizeRouterBase = (value) => {
  const path = String(value || "/").trim().replace(/^\/+|\/+$/g, "");
  return path ? `/${path}/` : "/";
};

export const API_BASE = trimTrailingSlash(import.meta.env.VITE_API_BASE || "");
export const LAYOUT_MODE = import.meta.env.VITE_LAYOUT_MODE === "embedded" ? "embedded" : "standalone";
export const IS_EMBEDDED_LAYOUT = LAYOUT_MODE === "embedded";
export const ROUTER_BASE = normalizeRouterBase(import.meta.env.VITE_ROUTER_BASE);

export const AUTH_STORAGE_KEYS = {
  token: "ailounge_token",
  user: "ailounge_user",
};

export const AUTH_EXPIRED_EVENT = "ailounge:auth-expired";
