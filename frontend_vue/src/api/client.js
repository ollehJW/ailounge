export const API_BASE = import.meta.env.VITE_API_BASE || "";

export const resolveApiUrl = (path) => {
  if (!path || /^https?:\/\//.test(path)) return path;
  return `${API_BASE}${path}`;
};

export const readApiError = async (response, fallback) => {
  const data = await response.json().catch(() => ({}));
  return new Error(data.detail || fallback);
};

export const apiFetch = async (path, options = {}) => {
  const token = window.localStorage.getItem("ailounge_token");
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(resolveApiUrl(path), { ...options, headers });
  if (response.status === 401 && token) {
    window.localStorage.removeItem("ailounge_token");
    window.localStorage.removeItem("ailounge_user");
    window.dispatchEvent(new CustomEvent("ailounge:auth-expired"));
  }
  return response;
};
