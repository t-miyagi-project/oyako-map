"use client";

const ACCESS_TOKEN_KEY = "oyako:access_token";
const REFRESH_TOKEN_KEY = "oyako:refresh_token";

const isBrowser = () => typeof window !== "undefined";

export function setTokens(accessToken: string, refreshToken?: string | null) {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearTokens() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function hasAuthToken() {
  return !!getAccessToken() || !!getRefreshToken();
}

export async function refreshTokens(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const res = await fetch(new URL("/api/auth/refresh", base), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) {
    clearTokens();
    return null;
  }
  const data = (await res.json()) as { access_token: string; refresh_token?: string };
  setTokens(data.access_token, data.refresh_token ?? refresh);
  return data.access_token;
}

export async function authFetch(input: string, init?: RequestInit, retry = true): Promise<Response> {
  const headers = new Headers(init?.headers ?? {});
  const access = getAccessToken();
  if (access) {
    headers.set("Authorization", `Bearer ${access}`);
  }
  const response = await fetch(input, {
    ...init,
    headers,
  });
  if (response.status === 401 && retry) {
    const newAccess = await refreshTokens();
    if (!newAccess) {
      return response;
    }
    const retryHeaders = new Headers(init?.headers ?? {});
    retryHeaders.set("Authorization", `Bearer ${newAccess}`);
    return fetch(input, {
      ...init,
      headers: retryHeaders,
    });
  }
  return response;
}
