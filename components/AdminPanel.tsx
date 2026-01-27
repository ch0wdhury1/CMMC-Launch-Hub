import React, { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../src/firebase";
import { useUserProfile } from "../src/useUserProfile";

type ActivationDoc = {
  appEnabled?: boolean;
  allowSignup?: boolean;
  allowTrack1?: boolean;
  allowTrack2?: boolean;
  message?: string;
  [key: string]: any;
};

export const AdminPanel: React.FC = () => {
  const { loading: profileLoading, profile } = useUserProfile();
  const isSuperAdmin = !!profile?.roles?.superAdmin;

  const [loading, setLoading] = useState(true);
  const [activation, setActivation] = useState<ActivationDoc | null>(null);
  const [saveMsg, setSaveMsg] = useState<string>("");

  const activationRef = useMemo(() => doc(db, "system", "activation"), []);

  useEffect(() => {
    const unsub = onSnapshot(
      activationRef,
      (snap) => {
        setActivation((snap.data() || {}) as ActivationDoc);
        setLoading(false);
      },
      (err) => {
        console.error("activation snapshot error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [activationRef]);

  const updateField = (key: string, value: any) => {
    setActivation((prev) => ({ ...(prev || {}), [key]: value }));
  };

  const handleSave = async () => {
    setSaveMsg("");
    try {
      if (!isSuperAdmin) {
        setSaveMsg("❌ Not authorized (super admin only).");
        return;
      }
      await setDoc(activationRef, activation || {}, { merge: true });
      setSaveMsg("✅ Saved.");
    } catch (e: any) {
      console.error("save activation error:", e);
      setSaveMsg(`❌ Save failed: ${e?.message || "Unknown error"}`);
    }
  };

  if (profileLoading || loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-sm text-gray-600">Loading Admin Panel…</div>
      </div>
    );
  }

  // Even though UI will be gated, keep this as defense-in-depth.
  if (!isSuperAdmin) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-red-100">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Admin Panel</h2>
        <p className="text-sm text-red-600">
          You don’t have access to this area.
        </p>
      </div>
    );
  }

  const appEnabled = !!activation?.appEnabled;
  const allowSignup = activation?.allowSignup !== false; // default true
  const allowTrack1 = activation?.allowTrack1 !== false; // default true
  const allowTrack2 = !!activation?.allowTrack2; // default false
  const message = activation?.message || "";

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Admin Panel</h2>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Save
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-1">
          Controls stored in <code>system/activation</code>. Super Admin only.
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center justify-between border rounded p-3 bg-gray-50">
            <span className="text-sm font-medium text-gray-800">App Enabled</span>
            <input
              type="checkbox"
              checked={appEnabled}
              onChange={(e) => updateField("appEnabled", e.target.checked)}
            />
          </label>

          <label className="flex items-center justify-between border rounded p-3 bg-gray-50">
            <span className="text-sm font-medium text-gray-800">Allow Signup</span>
            <input
              type="checkbox"
              checked={allowSignup}
              onChange={(e) => updateField("allowSignup", e.target.checked)}
            />
          </label>

          <label className="flex items-center justify-between border rounded p-3 bg-gray-50">
            <span className="text-sm font-medium text-gray-800">Allow Track 1 (CT Sponsored)</span>
            <input
              type="checkbox"
              checked={allowTrack1}
              onChange={(e) => updateField("allowTrack1", e.target.checked)}
            />
          </label>

          <label className="flex items-center justify-between border rounded p-3 bg-gray-50">
            <span className="text-sm font-medium text-gray-800">Allow Track 2 (Commercial)</span>
            <input
              type="checkbox"
              checked={allowTrack2}
              onChange={(e) => updateField("allowTrack2", e.target.checked)}
            />
          </label>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            Banner / Login Message (optional)
          </label>
          <textarea
            value={message}
            onChange={(e) => updateField("message", e.target.value)}
            className="w-full border rounded p-3 text-sm bg-white text-black"
            rows={3}
            placeholder="Example: Track 2 is currently waitlisted. Contact support@..."
          />
        </div>

        {saveMsg && (
          <div className="mt-3 text-sm">
            <span>{saveMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};
