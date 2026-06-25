import React, { useEffect, useMemo, useState } from "react";
import { Briefcase, ExternalLink, MapPin, Search, Star, Store } from "lucide-react";
import {
  loadAdminMarketplaceReviews,
  loadAdminMarketplaceVendors,
  loadMarketplaceEngagements,
  loadMarketplaceReviews,
  loadMarketplaceVendors,
  MARKETPLACE_CATEGORIES,
  moderateMarketplaceReview,
  saveMarketplaceVendor,
  saveMarketplaceEngagement,
  submitMarketplaceReview,
  type MarketplaceEngagement,
  type MarketplaceReview,
  type MarketplaceReviewInput,
  type MarketplaceVendor,
} from "../src/marketplace";

type Props = {
  isSuperAdmin?: boolean;
  canSubmitReviews?: boolean;
};

const emptyVendor: MarketplaceVendor = {
  companyName: "",
  description: "",
  primaryCategory: "CONSULTING",
  subcategories: [],
  cyberAbRoles: [],
  website: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  country: "US",
  serviceArea: [],
  remoteAvailable: false,
  languages: [],
  yearsInBusiness: "",
  industriesServed: [],
  programsSupported: [],
  programIds: [],
  status: "active",
  featured: false,
};

const listText = (items?: string[]) => (items || []).filter(Boolean).join(", ");
const parseList = (value: string) => value.split(",").map(item => item.trim()).filter(Boolean);

const badgeClass = "inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700";
const ratingText = (rating?: number, count?: number) => rating && count ? `${rating.toFixed(1)} (${count})` : "No reviews";
const formatDate = (value: any) => {
  if (!value) return "Not provided";
  const date = value?.toDate ? value.toDate() : value?._seconds ? new Date(value._seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleDateString();
};

export const MarketplacePage: React.FC<Props> = ({ isSuperAdmin = false, canSubmitReviews = false }) => {
  const [vendors, setVendors] = useState<MarketplaceVendor[]>([]);
  const [adminReviews, setAdminReviews] = useState<MarketplaceReview[]>([]);
  const [engagements, setEngagements] = useState<MarketplaceEngagement[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<MarketplaceVendor | null>(null);
  const [editingVendor, setEditingVendor] = useState<MarketplaceVendor | null>(null);
  const [reviewingVendor, setReviewingVendor] = useState<MarketplaceVendor | null>(null);
  const [engagingVendor, setEngagingVendor] = useState<MarketplaceVendor | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [role, setRole] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [programFilter, setProgramFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const nextVendors = isSuperAdmin ? await loadAdminMarketplaceVendors() : await loadMarketplaceVendors();
      setVendors(nextVendors);
      if (isSuperAdmin) setAdminReviews(await loadAdminMarketplaceReviews());
      if (canSubmitReviews) setEngagements(await loadMarketplaceEngagements());
    } catch (loadError) {
      console.error("[marketplace] load failed", loadError);
      setError(loadError instanceof Error ? loadError.message : "Marketplace is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [isSuperAdmin, canSubmitReviews]);

  const roleOptions = useMemo(() => Array.from(new Set(vendors.flatMap(vendor => vendor.cyberAbRoles || []))).sort(), [vendors]);
  const stateOptions = useMemo(() => Array.from(new Set(vendors.map(vendor => vendor.state || "").filter(Boolean))).sort(), [vendors]);
  const programOptions = useMemo(() => Array.from(new Set(vendors.flatMap(vendor => vendor.programsSupported || []))).sort(), [vendors]);

  const filteredVendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter(vendor => {
      if (!isSuperAdmin && vendor.status !== "active") return false;
      const haystack = [
        vendor.companyName,
        vendor.primaryCategory,
        vendor.state,
        vendor.description,
        ...(vendor.subcategories || []),
        ...(vendor.cyberAbRoles || []),
      ].join(" ").toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (category && vendor.primaryCategory !== category) return false;
      if (role && !(vendor.cyberAbRoles || []).includes(role)) return false;
      if (stateFilter && vendor.state !== stateFilter) return false;
      if (remoteOnly && vendor.remoteAvailable !== true) return false;
      if (featuredOnly && vendor.featured !== true) return false;
      if (programFilter && !(vendor.programsSupported || []).includes(programFilter)) return false;
      return true;
    });
  }, [category, featuredOnly, isSuperAdmin, programFilter, remoteOnly, role, search, stateFilter, vendors]);

  const engagementByVendor = useMemo(() => new Map(engagements.map(engagement => [engagement.vendorId, engagement])), [engagements]);

  const updateEdit = (field: keyof MarketplaceVendor, value: any) => {
    setEditingVendor(current => current ? ({ ...current, [field]: value }) : current);
  };

  const saveEdit = async () => {
    if (!editingVendor) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveMarketplaceVendor(editingVendor);
      setMessage("Vendor saved.");
      setEditingVendor(null);
      await reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save vendor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-700">Curated directory</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-gray-900"><Store className="h-6 w-6 text-blue-700" /> CMMC Marketplace</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">Find trusted CMMC service providers, software, hardware, and training resources. Marketplace records are directory listings only and do not include evidence, assessment notes, remediation details, AI conversations, or report content.</p>
          </div>
          {isSuperAdmin ? (
            <button type="button" onClick={() => setEditingVendor({ ...emptyVendor })} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
              Add Vendor
            </button>
          ) : null}
        </div>
      </section>

      {message ? <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{error}</div> : null}

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-6">
          <label className="lg:col-span-2">
            <span className="text-xs font-semibold uppercase text-gray-500">Search</span>
            <div className="mt-1 flex items-center rounded border px-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Company, category, role, state" className="w-full px-2 py-2 text-sm outline-none" />
            </div>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-gray-500">Category</span>
            <select value={category} onChange={event => setCategory(event.target.value)} className="mt-1 w-full rounded border px-2 py-2 text-sm">
              <option value="">All</option>
              {MARKETPLACE_CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-gray-500">CyberAB Role</span>
            <select value={role} onChange={event => setRole(event.target.value)} className="mt-1 w-full rounded border px-2 py-2 text-sm">
              <option value="">All</option>
              {roleOptions.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-gray-500">State</span>
            <select value={stateFilter} onChange={event => setStateFilter(event.target.value)} className="mt-1 w-full rounded border px-2 py-2 text-sm">
              <option value="">All</option>
              {stateOptions.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase text-gray-500">Program</span>
            <select value={programFilter} onChange={event => setProgramFilter(event.target.value)} className="mt-1 w-full rounded border px-2 py-2 text-sm">
              <option value="">All</option>
              {programOptions.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={remoteOnly} onChange={event => setRemoteOnly(event.target.checked)} /> Remote Available</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={featuredOnly} onChange={event => setFeaturedOnly(event.target.checked)} /> Featured</label>
        </div>
      </section>

      {loading ? <div className="rounded-lg border bg-white p-6 text-sm text-gray-600">Loading Marketplace...</div> : null}

      {!loading && (
        <section className="grid gap-4 xl:grid-cols-3">
          {filteredVendors.map(vendor => (
            <article key={vendor.id} className="rounded-lg border bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded border bg-gray-50 text-blue-700">
                  {vendor.logoUrl ? <img src={vendor.logoUrl} alt="" className="max-h-12 max-w-12 object-contain" /> : <Briefcase className="h-6 w-6" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <h2 className="text-lg font-bold text-gray-900">{vendor.companyName}</h2>
                    {vendor.featured ? <Star className="mt-1 h-4 w-4 fill-amber-400 text-amber-400" /> : null}
                  </div>
                  <p className="mt-1 text-xs font-semibold uppercase text-blue-700">{vendor.primaryCategory}</p>
                  <p className="mt-2 text-sm font-semibold text-amber-700">★ {ratingText(vendor.averageRating, vendor.reviewCount)}</p>
                  <p className="mt-2 line-clamp-3 text-sm text-gray-600">{vendor.description}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(vendor.cyberAbRoles || []).map(item => <span key={item} className={badgeClass}>{item}</span>)}
                {(vendor.subcategories || []).slice(0, 3).map(item => <span key={item} className="inline-flex rounded-full border bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-600">{item}</span>)}
              </div>
              <p className="mt-4 flex items-center text-sm text-gray-600"><MapPin className="mr-1 h-4 w-4 text-gray-400" /> {[vendor.city, vendor.state].filter(Boolean).join(", ") || "Location not provided"}</p>
              <p className="mt-1 text-sm text-gray-600">{vendor.remoteAvailable ? "Remote available" : "Remote availability not listed"}</p>
              {isSuperAdmin ? <p className="mt-1 text-xs font-semibold uppercase text-gray-500">Status: {vendor.status}</p> : null}
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setSelectedVendor(vendor)} className="rounded border border-blue-200 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">View Details</button>
                {canSubmitReviews && vendor.status === "active" ? <button type="button" onClick={() => setReviewingVendor(vendor)} className="rounded border border-amber-200 px-3 py-1.5 text-sm font-semibold text-amber-700 hover:bg-amber-50">Submit Review</button> : null}
                {canSubmitReviews && vendor.status === "active" ? <button type="button" onClick={() => setEngagingVendor(vendor)} className="rounded border border-emerald-200 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">{vendor.id && engagementByVendor.has(vendor.id) ? "Manage Engagement" : "Working With This Vendor"}</button> : null}
                {isSuperAdmin ? <button type="button" onClick={() => setEditingVendor({ ...vendor })} className="rounded border px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Edit</button> : null}
              </div>
            </article>
          ))}
          {!filteredVendors.length ? <div className="rounded-lg border bg-white p-6 text-sm text-gray-600 xl:col-span-3">No vendors found.</div> : null}
        </section>
      )}

      {selectedVendor ? (
        <VendorDetail
          vendor={selectedVendor}
          engagement={selectedVendor.id ? engagementByVendor.get(selectedVendor.id) : undefined}
          canSubmitReview={canSubmitReviews && selectedVendor.status === "active"}
          onSubmitReview={() => setReviewingVendor(selectedVendor)}
          onManageEngagement={() => setEngagingVendor(selectedVendor)}
          onClose={() => setSelectedVendor(null)}
        />
      ) : null}

      {canSubmitReviews ? (
        <MyVendorEngagements engagements={engagements} onManage={(engagement) => {
          const vendor = vendors.find(item => item.id === engagement.vendorId);
          if (vendor) setEngagingVendor(vendor);
        }} />
      ) : null}

      {isSuperAdmin ? (
        <MarketplaceReviewModeration
          reviews={adminReviews}
          onModerate={async (reviewId, status) => {
            setSaving(true);
            setError("");
            setMessage("");
            try {
              await moderateMarketplaceReview(reviewId, status);
              setMessage(`Review ${status}.`);
              await reload();
            } catch (moderationError) {
              setError(moderationError instanceof Error ? moderationError.message : "Unable to moderate review.");
            } finally {
              setSaving(false);
            }
          }}
          busy={saving}
        />
      ) : null}

      {reviewingVendor ? (
        <ReviewForm
          vendor={reviewingVendor}
          onCancel={() => setReviewingVendor(null)}
          onSubmitted={async () => {
            setReviewingVendor(null);
            setMessage("Review submitted for SuperAdmin moderation.");
            await reload();
          }}
          onError={setError}
        />
      ) : null}

      {engagingVendor ? (
        <EngagementForm
          vendor={engagingVendor}
          engagement={engagingVendor.id ? engagementByVendor.get(engagingVendor.id) : undefined}
          onCancel={() => setEngagingVendor(null)}
          onSaved={async () => {
            setEngagingVendor(null);
            setMessage("Vendor engagement saved.");
            await reload();
          }}
          onError={setError}
        />
      ) : null}

      {editingVendor ? (
        <VendorEditor
          vendor={editingVendor}
          saving={saving}
          onChange={setEditingVendor}
          onCancel={() => setEditingVendor(null)}
          onSave={saveEdit}
          updateEdit={updateEdit}
        />
      ) : null}
    </div>
  );
};

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
    <div className="mt-1 text-sm text-gray-900">{value || "Not provided"}</div>
  </div>
);

const VendorDetail = ({ vendor, engagement, canSubmitReview, onSubmitReview, onManageEngagement, onClose }: { vendor: MarketplaceVendor; engagement?: MarketplaceEngagement; canSubmitReview: boolean; onSubmitReview: () => void; onManageEngagement: () => void; onClose: () => void }) => {
  const [reviews, setReviews] = useState<MarketplaceReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingReviews(true);
      try {
        const loaded = vendor.id ? await loadMarketplaceReviews(vendor.id) : [];
        if (!cancelled) setReviews(loaded);
      } catch (error) {
        console.error("[marketplace-reviews] load failed", error);
        if (!cancelled) setReviews([]);
      } finally {
        if (!cancelled) setLoadingReviews(false);
      }
    })();
    return () => { cancelled = true; };
  }, [vendor.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b p-5">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-700">Vendor Profile</p>
            <h2 className="mt-1 text-2xl font-bold text-gray-900">{vendor.companyName}</h2>
            <p className="mt-2 text-sm font-semibold text-amber-700">★ {ratingText(vendor.averageRating, vendor.reviewCount)}</p>
            {vendor.featured ? <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Featured</span> : null}
          </div>
          <div className="flex gap-2">
            {canSubmitReview ? <button type="button" onClick={onSubmitReview} className="rounded border border-amber-200 px-3 py-1 text-sm font-semibold text-amber-700 hover:bg-amber-50">Submit Review</button> : null}
            {canSubmitReview ? <button type="button" onClick={onManageEngagement} className="rounded border border-emerald-200 px-3 py-1 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">{engagement ? "Manage Engagement" : "Working With This Vendor"}</button> : null}
            <button type="button" onClick={onClose} className="rounded border px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50">Close</button>
          </div>
        </div>
        {engagement ? (
          <div className="border-b bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800">
            Used by your organization: {engagement.status}{engagement.status === "active" ? " active engagement" : ""}
          </div>
        ) : null}
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <DetailRow label="Description" value={<p>{vendor.description}</p>} />
          <DetailRow label="Primary Category" value={vendor.primaryCategory} />
          <DetailRow label="Subcategories" value={listText(vendor.subcategories)} />
          <DetailRow label="CyberAB Roles" value={listText(vendor.cyberAbRoles)} />
          <DetailRow label="Website" value={vendor.website ? <a className="inline-flex items-center text-blue-700 hover:underline" href={vendor.website} target="_blank" rel="noreferrer">{vendor.website}<ExternalLink className="ml-1 h-3 w-3" /></a> : "Not provided"} />
          <DetailRow label="Email" value={vendor.email} />
          <DetailRow label="Phone" value={vendor.phone} />
          <DetailRow label="Address" value={[vendor.address, vendor.city, vendor.state, vendor.country].filter(Boolean).join(", ")} />
          <DetailRow label="Service Area" value={listText(vendor.serviceArea)} />
          <DetailRow label="Remote Available" value={vendor.remoteAvailable ? "Yes" : "No"} />
          <DetailRow label="Languages" value={listText(vendor.languages)} />
          <DetailRow label="Years in Business" value={vendor.yearsInBusiness} />
          <DetailRow label="Industries Served" value={listText(vendor.industriesServed)} />
          <DetailRow label="Programs Supported" value={listText(vendor.programsSupported)} />
        </div>
        <div className="border-t p-5">
          <h3 className="text-lg font-bold text-gray-900">Participant Reviews</h3>
          {loadingReviews ? <p className="mt-3 text-sm text-gray-500">Loading reviews...</p> : null}
          {!loadingReviews && !reviews.length ? <p className="mt-3 text-sm text-gray-500">No approved reviews yet.</p> : null}
          <div className="mt-3 space-y-3">
            {reviews.map(review => (
              <div key={review.id} className="rounded border bg-gray-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-amber-700">★ {review.overallRating}/5</span>
                  <span className="text-xs text-gray-500">{formatDate(review.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-gray-900">{review.orgName || "Participant organization"}</p>
                <p className="mt-2 text-sm text-gray-700">{review.comment}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

const RatingSelect = ({ label, value, onChange, required = false }: { label: string; value: number | ""; onChange: (value: number | "") => void; required?: boolean }) => (
  <label>
    <span className="text-xs font-semibold uppercase text-gray-500">{label}</span>
    <select value={value} required={required} onChange={event => onChange(event.target.value ? Number(event.target.value) : "")} className="mt-1 w-full rounded border px-3 py-2 text-sm">
      <option value="">{required ? "Select rating" : "Optional"}</option>
      {[1, 2, 3, 4, 5].map(item => <option key={item} value={item}>{item}</option>)}
    </select>
  </label>
);

const ReviewForm = ({ vendor, onCancel, onSubmitted, onError }: { vendor: MarketplaceVendor; onCancel: () => void; onSubmitted: () => void; onError: (message: string) => void }) => {
  const [draft, setDraft] = useState<MarketplaceReviewInput>({ overallRating: "" as any, communicationRating: "", responsivenessRating: "", cmmcExpertiseRating: "", valueRating: "", comment: "" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!vendor.id) return;
    setSaving(true);
    try {
      await submitMarketplaceReview(vendor.id, draft);
      onSubmitted();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to submit review.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <section className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="border-b p-5">
          <p className="text-xs font-semibold uppercase text-blue-700">Pending moderation</p>
          <h2 className="text-2xl font-bold text-gray-900">Review {vendor.companyName}</h2>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <RatingSelect label="Overall Rating" required value={draft.overallRating as any} onChange={value => setDraft(current => ({ ...current, overallRating: value as any }))} />
          <RatingSelect label="Communication" value={draft.communicationRating || ""} onChange={value => setDraft(current => ({ ...current, communicationRating: value }))} />
          <RatingSelect label="Responsiveness" value={draft.responsivenessRating || ""} onChange={value => setDraft(current => ({ ...current, responsivenessRating: value }))} />
          <RatingSelect label="CMMC Expertise" value={draft.cmmcExpertiseRating || ""} onChange={value => setDraft(current => ({ ...current, cmmcExpertiseRating: value }))} />
          <RatingSelect label="Value" value={draft.valueRating || ""} onChange={value => setDraft(current => ({ ...current, valueRating: value }))} />
          <label className="md:col-span-2">
            <span className="text-xs font-semibold uppercase text-gray-500">Comment</span>
            <textarea value={draft.comment} onChange={event => setDraft(current => ({ ...current, comment: event.target.value }))} className="mt-1 h-28 w-full rounded border px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t p-5">
          <button type="button" onClick={onCancel} className="rounded border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={submit} disabled={saving || !draft.overallRating || !draft.comment.trim()} className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">Submit Review</button>
        </div>
      </section>
    </div>
  );
};

const statusClass = (status: string) => status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200";

const MarketplaceReviewModeration = ({ reviews, onModerate, busy }: { reviews: MarketplaceReview[]; onModerate: (reviewId: string, status: "approved" | "rejected") => void; busy: boolean }) => (
  <section className="rounded-lg border bg-white shadow-sm">
    <div className="border-b p-4">
      <h2 className="text-lg font-bold text-gray-900">Marketplace Reviews</h2>
      <p className="mt-1 text-sm text-gray-600">SuperAdmin moderation queue. Reviewer email is shown only here for operational moderation.</p>
    </div>
    <div className="overflow-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr><th className="p-3">Vendor</th><th className="p-3">Reviewer Org</th><th className="p-3">Rating</th><th className="p-3">Comment Preview</th><th className="p-3">Status</th><th className="p-3">Date</th><th className="p-3">Actions</th></tr>
        </thead>
        <tbody>
          {reviews.map(review => (
            <tr key={review.id} className="border-t">
              <td className="p-3 font-semibold text-gray-900">{review.vendorName}</td>
              <td className="p-3">{review.orgName || review.orgId}</td>
              <td className="p-3">{review.overallRating}/5</td>
              <td className="max-w-md p-3">{review.comment.slice(0, 180)}{review.comment.length > 180 ? "..." : ""}</td>
              <td className="p-3"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(review.status)}`}>{review.status}</span></td>
              <td className="p-3">{formatDate(review.createdAt)}</td>
              <td className="p-3">
                <div className="flex gap-2">
                  <button type="button" disabled={busy || review.status === "approved"} onClick={() => onModerate(review.id, "approved")} className="rounded border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40">Approve</button>
                  <button type="button" disabled={busy || review.status === "rejected"} onClick={() => onModerate(review.id, "rejected")} className="rounded border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40">Reject</button>
                </div>
              </td>
            </tr>
          ))}
          {!reviews.length ? <tr><td colSpan={7} className="p-5 text-sm text-gray-500">No marketplace reviews yet.</td></tr> : null}
        </tbody>
      </table>
    </div>
  </section>
);

const MyVendorEngagements = ({ engagements, onManage }: { engagements: MarketplaceEngagement[]; onManage: (engagement: MarketplaceEngagement) => void }) => (
  <section className="rounded-lg border bg-white shadow-sm">
    <div className="border-b p-4">
      <h2 className="text-lg font-bold text-gray-900">My Vendor Engagements</h2>
      <p className="mt-1 text-sm text-gray-600">Track vendors your organization is evaluating, using, or has completed work with.</p>
    </div>
    <div className="overflow-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr><th className="p-3">Vendor Name</th><th className="p-3">Engagement Type</th><th className="p-3">Status</th><th className="p-3">Start Date</th><th className="p-3">End Date</th><th className="p-3">Last Updated</th><th className="p-3">Manage</th></tr>
        </thead>
        <tbody>
          {engagements.map(engagement => (
            <tr key={engagement.id || engagement.vendorId} className="border-t">
              <td className="p-3 font-semibold text-gray-900">{engagement.vendorName}</td>
              <td className="p-3">{engagement.engagementType}</td>
              <td className="p-3">{engagement.status}</td>
              <td className="p-3">{engagement.startDate || "Not provided"}</td>
              <td className="p-3">{engagement.endDate || "Not provided"}</td>
              <td className="p-3">{formatDate(engagement.updatedAt)}</td>
              <td className="p-3"><button type="button" onClick={() => onManage(engagement)} className="rounded border px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50">Manage</button></td>
            </tr>
          ))}
          {!engagements.length ? <tr><td colSpan={7} className="p-5 text-sm text-gray-500">No vendor engagements yet.</td></tr> : null}
        </tbody>
      </table>
    </div>
  </section>
);

const EngagementForm = ({ vendor, engagement, onCancel, onSaved, onError }: { vendor: MarketplaceVendor; engagement?: MarketplaceEngagement; onCancel: () => void; onSaved: () => void; onError: (message: string) => void }) => {
  const [draft, setDraft] = useState<Partial<MarketplaceEngagement>>({
    vendorId: vendor.id || "",
    engagementType: engagement?.engagementType || (vendor.primaryCategory as string) || "OTHER",
    status: engagement?.status || "evaluating",
    startDate: engagement?.startDate || "",
    endDate: engagement?.endDate || "",
    serviceDescription: engagement?.serviceDescription || "",
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!vendor.id) return;
    setSaving(true);
    try {
      await saveMarketplaceEngagement({ ...draft, vendorId: vendor.id });
      onSaved();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to save engagement.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <section className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="border-b p-5">
          <p className="text-xs font-semibold uppercase text-emerald-700">Organization vendor tracking</p>
          <h2 className="text-2xl font-bold text-gray-900">{engagement ? "Manage Engagement" : "Working With This Vendor"}</h2>
          <p className="mt-1 text-sm text-gray-600">{vendor.companyName}</p>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="Engagement Type">
            <select value={draft.engagementType || "OTHER"} onChange={event => setDraft(current => ({ ...current, engagementType: event.target.value }))} className="w-full rounded border px-3 py-2 text-sm">
              {["CONSULTING", "SOFTWARE", "HARDWARE", "TRAINING", "ASSESSMENT", "OTHER"].map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={draft.status || "evaluating"} onChange={event => setDraft(current => ({ ...current, status: event.target.value }))} className="w-full rounded border px-3 py-2 text-sm">
              {["evaluating", "active", "completed", "paused", "cancelled"].map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Start Date"><input type="date" value={draft.startDate || ""} onChange={event => setDraft(current => ({ ...current, startDate: event.target.value }))} className="w-full rounded border px-3 py-2 text-sm" /></Field>
          <Field label="End Date"><input type="date" value={draft.endDate || ""} onChange={event => setDraft(current => ({ ...current, endDate: event.target.value }))} className="w-full rounded border px-3 py-2 text-sm" /></Field>
          <label className="md:col-span-2">
            <span className="text-xs font-semibold uppercase text-gray-500">Service Description</span>
            <textarea value={draft.serviceDescription || ""} onChange={event => setDraft(current => ({ ...current, serviceDescription: event.target.value }))} className="mt-1 h-24 w-full rounded border px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t p-5">
          <button type="button" onClick={onCancel} className="rounded border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={submit} disabled={saving} className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">Save Engagement</button>
        </div>
      </section>
    </div>
  );
};

type EditorProps = {
  vendor: MarketplaceVendor;
  saving: boolean;
  onChange: (vendor: MarketplaceVendor) => void;
  onCancel: () => void;
  onSave: () => void;
  updateEdit: (field: keyof MarketplaceVendor, value: any) => void;
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="text-xs font-semibold uppercase text-gray-500">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

const VendorEditor: React.FC<EditorProps> = ({ vendor, saving, onCancel, onSave, updateEdit }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <section className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-lg bg-white shadow-xl">
      <div className="flex items-center justify-between border-b p-5">
        <div>
          <p className="text-xs font-semibold uppercase text-blue-700">SuperAdmin management</p>
          <h2 className="text-2xl font-bold text-gray-900">{vendor.id ? "Edit Vendor" : "Add Vendor"}</h2>
        </div>
        <button type="button" onClick={onCancel} className="rounded border px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-2">
        <Field label="Company Name"><input value={vendor.companyName} onChange={event => updateEdit("companyName", event.target.value)} className="w-full rounded border px-3 py-2 text-sm" /></Field>
        <Field label="Logo URL"><input value={vendor.logoUrl || ""} onChange={event => updateEdit("logoUrl", event.target.value)} className="w-full rounded border px-3 py-2 text-sm" /></Field>
        <Field label="Primary Category">
          <select value={vendor.primaryCategory} onChange={event => updateEdit("primaryCategory", event.target.value)} className="w-full rounded border px-3 py-2 text-sm">
            {MARKETPLACE_CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={vendor.status} onChange={event => updateEdit("status", event.target.value)} className="w-full rounded border px-3 py-2 text-sm">
            <option value="active">active</option>
            <option value="inactive">inactive</option>
            <option value="archived">archived</option>
          </select>
        </Field>
        <Field label="Description"><textarea value={vendor.description} onChange={event => updateEdit("description", event.target.value)} className="h-28 w-full rounded border px-3 py-2 text-sm" /></Field>
        <Field label="Subcategories"><input value={listText(vendor.subcategories)} onChange={event => updateEdit("subcategories", parseList(event.target.value))} className="w-full rounded border px-3 py-2 text-sm" /></Field>
        <Field label="CyberAB Roles"><input value={listText(vendor.cyberAbRoles)} onChange={event => updateEdit("cyberAbRoles", parseList(event.target.value))} placeholder="RP, CCP, CCA, RPO, C3PAO" className="w-full rounded border px-3 py-2 text-sm" /></Field>
        <Field label="Website"><input value={vendor.website || ""} onChange={event => updateEdit("website", event.target.value)} className="w-full rounded border px-3 py-2 text-sm" /></Field>
        <Field label="Email"><input value={vendor.email || ""} onChange={event => updateEdit("email", event.target.value)} className="w-full rounded border px-3 py-2 text-sm" /></Field>
        <Field label="Phone"><input value={vendor.phone || ""} onChange={event => updateEdit("phone", event.target.value)} className="w-full rounded border px-3 py-2 text-sm" /></Field>
        <Field label="Address"><input value={vendor.address || ""} onChange={event => updateEdit("address", event.target.value)} className="w-full rounded border px-3 py-2 text-sm" /></Field>
        <Field label="City"><input value={vendor.city || ""} onChange={event => updateEdit("city", event.target.value)} className="w-full rounded border px-3 py-2 text-sm" /></Field>
        <Field label="State"><input value={vendor.state || ""} onChange={event => updateEdit("state", event.target.value)} className="w-full rounded border px-3 py-2 text-sm" /></Field>
        <Field label="Country"><input value={vendor.country || ""} onChange={event => updateEdit("country", event.target.value)} className="w-full rounded border px-3 py-2 text-sm" /></Field>
        <Field label="Service Area"><input value={listText(vendor.serviceArea)} onChange={event => updateEdit("serviceArea", parseList(event.target.value))} className="w-full rounded border px-3 py-2 text-sm" /></Field>
        <Field label="Languages"><input value={listText(vendor.languages)} onChange={event => updateEdit("languages", parseList(event.target.value))} className="w-full rounded border px-3 py-2 text-sm" /></Field>
        <Field label="Years In Business"><input value={vendor.yearsInBusiness || ""} onChange={event => updateEdit("yearsInBusiness", event.target.value)} className="w-full rounded border px-3 py-2 text-sm" /></Field>
        <Field label="Industries Served"><input value={listText(vendor.industriesServed)} onChange={event => updateEdit("industriesServed", parseList(event.target.value))} className="w-full rounded border px-3 py-2 text-sm" /></Field>
        <Field label="Programs Supported"><input value={listText(vendor.programsSupported)} onChange={event => updateEdit("programsSupported", parseList(event.target.value))} className="w-full rounded border px-3 py-2 text-sm" /></Field>
        <Field label="Program IDs"><input value={listText(vendor.programIds)} onChange={event => updateEdit("programIds", parseList(event.target.value))} className="w-full rounded border px-3 py-2 text-sm" /></Field>
        <div className="flex items-center gap-5 md:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={vendor.remoteAvailable === true} onChange={event => updateEdit("remoteAvailable", event.target.checked)} /> Remote Available</label>
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={vendor.featured === true} onChange={event => updateEdit("featured", event.target.checked)} /> Featured</label>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t p-5">
        <button type="button" onClick={onCancel} className="rounded border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
        <button type="button" onClick={onSave} disabled={saving} className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">Save Vendor</button>
      </div>
    </section>
  </div>
);
