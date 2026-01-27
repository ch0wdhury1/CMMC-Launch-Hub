import { auth } from "./firebase";

// Debug: show what Vite injected
const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || "").trim();
console.log("[api.ts] VITE_API_BASE_URL =", RAW_BASE);

const API_BASE = RAW_BASE.endsWith("/") ? RAW_BASE.slice(0, -1) : RAW_BASE;

function requireBase() {
  if (!API_BASE) {
    throw new Error("Missing VITE_API_BASE_URL in .env.local (must be a full https URL)");
  }
  if (API_BASE.startsWith("/")) {
    throw new Error(`VITE_API_BASE_URL is relative (${API_BASE}). It must be https://...a.run.app`);
  }
}

export async function bootstrapUser() {
  requireBase();

  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const token = await user.getIdToken();

  const url = `${API_BASE}/api/bootstrap`;
  console.log("[api.ts] POST", url);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`bootstrap failed ${res.status}: ${text}`);

  return JSON.parse(text);
}

