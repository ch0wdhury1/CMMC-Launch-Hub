import { auth } from "../firebase";

export async function callGemini(prompt: string, opts?: { model?: string; temperature?: number }) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL as string;

  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${baseUrl}/api/ai/gemini`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      prompt,
      model: opts?.model, // optional
      temperature: opts?.temperature, // optional
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Gemini request failed");

  return data.text as string;
}
