export const API_BASE = import.meta.env.VITE_API_BASE || '';
export const AUTH_EXPIRED_EVENT = 'ailounge:auth-expired';

export const resolveApiUrl = (input) => {
  if (typeof input !== 'string') return input;
  if (input.startsWith('/api/')) return API_BASE + input;
  return input;
};

export const apiError = async (response, fallback) => {
  const data = await response.json().catch(() => ({}));
  return new Error(data.detail || fallback);
};

export const apiFetch = async (input, init = {}) => {
  const response = await window.fetch(resolveApiUrl(input), init);
  const hasAuthorization = new Headers(init.headers || {}).has('Authorization');
  if (response.status === 401 && hasAuthorization) {
    window.localStorage.removeItem('ailounge_token');
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
  return response;
};
