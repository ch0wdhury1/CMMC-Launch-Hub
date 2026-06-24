import { auth } from "./firebase";

export const SPONSOR_PROGRAM_OPTIONS = [
  "CT Manufacturing Pilot",
  "CCAT Sponsored Pilot",
  "DECD / Office of Manufacturing Pilot",
  "APEX Accelerator Pilot",
  "Cyber Blue Star Internal Pilot",
  "Other",
] as const;

export type SponsorProgramOption = typeof SPONSOR_PROGRAM_OPTIONS[number];

export type SponsorObserver = {
  uid: string;
  email: string;
  displayName?: string;
  fullName?: string;
  status?: "active" | "inactive" | string;
  sponsorProgram?: string;
  sponsorProgramOther?: string;
  observerType?: "program" | string;
  programIds?: string[];
  programCodes?: string[];
  createdAt?: any;
  updatedAt?: any;
  lastLoginAt?: any;
};

export type SponsorObserverInput = {
  uid?: string;
  email: string;
  displayName: string;
  temporaryPassword?: string;
  status: "active" | "inactive";
  sponsorProgram: string;
  sponsorProgramOther?: string;
  programId?: string;
  programCode?: string;
};

const apiBase = () => String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function authenticatedRequest(path: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required");
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await user.getIdToken()}`,
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.errorMessage || "Sponsor observer action failed");
  }
  return payload;
}

export async function loadSponsorObservers(): Promise<SponsorObserver[]> {
  const payload = await authenticatedRequest("/api/admin/sponsor-observers");
  return payload.observers || [];
}

export async function saveSponsorObserver(input: SponsorObserverInput): Promise<{message: string; observer: SponsorObserver}> {
  return authenticatedRequest("/api/admin/sponsor-observer", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function formatSponsorObserverDate(value: any): string {
  if (!value) return "Not provided";
  const date = value?.toDate ? value.toDate() : value?._seconds ? new Date(value._seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleDateString();
}
