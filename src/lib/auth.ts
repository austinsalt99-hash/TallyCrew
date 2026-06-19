const SECRET = process.env.JWT_SECRET ?? "fallback-secret";
const TOKEN_KEY = "cew-admin-token";
const VALID_HOURS = 12;

function base64url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function createToken(): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({ role: "admin", exp: Date.now() + VALID_HOURS * 3600 * 1000 })
  );
  const signature = base64url(`${header}.${payload}.${SECRET}`);
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const expected = base64url(`${parts[0]}.${parts[1]}.${SECRET}`);
    if (expected !== parts[2]) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

// Client-side helpers
export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}
