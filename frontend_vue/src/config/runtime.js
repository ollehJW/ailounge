const trimTrailingSlash = (value) => value.replace(/\/+$/, "");

export const API_BASE = trimTrailingSlash(import.meta.env.VITE_API_BASE || "");
export const API_PATH_PREFIX = `/${String(import.meta.env.VITE_API_PATH_PREFIX || "ai-lounge-api").replace(/^\/+|\/+$/g, "")}`;

export const AUTH_STORAGE_KEYS = {
  token: "ailounge_token",
  user: "ailounge_user",
};

export const AUTH_EXPIRED_EVENT = "ailounge:auth-expired";
