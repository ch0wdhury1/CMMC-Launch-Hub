import { auth } from "./firebase";

export const MARKETPLACE_CATEGORIES = ["CONSULTING", "SOFTWARE", "HARDWARE", "TRAINING", "ASSESSMENT", "OTHER"] as const;

export type MarketplaceCategory = typeof MARKETPLACE_CATEGORIES[number];

export type MarketplaceVendor = {
  id?: string;
  companyName: string;
  logoUrl?: string;
  description: string;
  primaryCategory: MarketplaceCategory | string;
  subcategories?: string[];
  cyberAbRoles?: string[];
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  serviceArea?: string[];
  remoteAvailable?: boolean;
  languages?: string[];
  yearsInBusiness?: string;
  industriesServed?: string[];
  programsSupported?: string[];
  programIds?: string[];
  status: "active" | "inactive" | "archived" | string;
  featured?: boolean;
  averageRating?: number;
  reviewCount?: number;
  createdAt?: any;
  updatedAt?: any;
};

export type MarketplaceReview = {
  id: string;
  vendorId: string;
  vendorName: string;
  orgId?: string;
  orgName: string;
  reviewerUid?: string;
  reviewerName?: string;
  reviewerEmail?: string;
  overallRating: number;
  communicationRating?: number | null;
  responsivenessRating?: number | null;
  cmmcExpertiseRating?: number | null;
  valueRating?: number | null;
  comment: string;
  status: "pending" | "approved" | "rejected" | string;
  createdAt?: any;
  updatedAt?: any;
  moderatedAt?: any;
  moderatedBy?: string;
};

export type MarketplaceReviewInput = {
  overallRating: number;
  communicationRating?: number | "";
  responsivenessRating?: number | "";
  cmmcExpertiseRating?: number | "";
  valueRating?: number | "";
  comment: string;
};

const apiBase = () => String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const isLocalDevHost = () => {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
};

const apiUrl = (path: string) => `${isLocalDevHost() ? "" : apiBase()}${path}`;

async function request(path: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required.");
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await user.getIdToken()}`,
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.errorMessage || "Marketplace request failed.");
  }
  return payload;
}

export async function loadMarketplaceVendors(): Promise<MarketplaceVendor[]> {
  const payload = await request("/api/marketplace/vendors");
  return payload.vendors || [];
}

export async function loadAdminMarketplaceVendors(): Promise<MarketplaceVendor[]> {
  const payload = await request("/api/admin/marketplace/vendors");
  return payload.vendors || [];
}

export async function saveMarketplaceVendor(vendor: MarketplaceVendor): Promise<MarketplaceVendor> {
  const payload = await request("/api/admin/marketplace/vendor", {
    method: "POST",
    body: JSON.stringify(vendor),
  });
  return payload.vendor;
}

export async function loadMarketplaceReviews(vendorId: string): Promise<MarketplaceReview[]> {
  const payload = await request(`/api/marketplace/vendor/${encodeURIComponent(vendorId)}/reviews`);
  return payload.reviews || [];
}

export async function submitMarketplaceReview(vendorId: string, review: MarketplaceReviewInput): Promise<MarketplaceReview> {
  const payload = await request(`/api/marketplace/vendor/${encodeURIComponent(vendorId)}/review`, {
    method: "POST",
    body: JSON.stringify(review),
  });
  return payload.review;
}

export async function loadAdminMarketplaceReviews(): Promise<MarketplaceReview[]> {
  const payload = await request("/api/admin/marketplace/reviews");
  return payload.reviews || [];
}

export async function moderateMarketplaceReview(reviewId: string, status: "approved" | "rejected"): Promise<MarketplaceReview> {
  const payload = await request("/api/admin/marketplace/review/moderate", {
    method: "POST",
    body: JSON.stringify({ reviewId, status }),
  });
  return payload.review;
}
