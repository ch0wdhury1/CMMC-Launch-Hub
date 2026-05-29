
console.log("🔥 LOGIN COMPONENT LOADED:", new Date().toISOString());

import { useMemo, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth, db } from "./firebase";
import {addDoc, collection, serverTimestamp, doc, setDoc} from "firebase/firestore";
import { bootstrapUserProfile } from "./bootstrapUserProfile";


import { HowItWorksPanel } from "./components/HowItWorksPanel";



export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // Register form extras (MVP)
  const [orgName, setOrgName] = useState("");
  const [requestedTier, setRequestedTier] = useState<"SPONSORED" | "COMM_L1" | "COMM_L2">("COMM_L1");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [primaryContactName, setPrimaryContactName] = useState("");
  const [primaryContactPhone, setPrimaryContactPhone] = useState("");
const cleanEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const emailLooksValid = useMemo(() => {
    // simple client-side check (Firebase will still validate server-side)
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
  }, [cleanEmail]);

  const passwordLooksValid = useMemo(() => password.length >= 6, [password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!emailLooksValid) {
      setMsg("❌ Please enter a valid email address (no spaces).");
      return;
    }
    if (!passwordLooksValid) {
      setMsg("❌ Password must be at least 6 characters.");
      return;
    }

    try {
      setBusy(true);

      if (mode === "login") {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
        await bootstrapUserProfile(); // ensures /users/{uid} exists
        setMsg("✅ Logged in");
      } else {
        // MVP: collect org registration details and send to Admin for approval
        if (!orgName.trim() || !primaryContactName.trim()) {
          setMsg("❌ Please enter Company Name and Primary Contact Name.");
          return;
        }

        const orgId =
          "org_" +
          orgName
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 40);

        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);

        // Ensure users/{uid} has orgId + pending status (merge-safe)
        await setDoc(
          doc(db, "users", cred.user.uid),
          {
            uid: cred.user.uid,
            email: cleanEmail,
            fullName: primaryContactName.trim(),
            phone: primaryContactPhone.trim(),
            orgId,
            status: "pending",
            roles: { orgRole: "orgAdmin" },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        try {
          await addDoc(collection(db, "accessRequests"), {
            type: "orgRegistration",
            status: "pending",

            orgId,
            requestedTier,

            orgName: orgName.trim(),
            website: website.trim(),
            address: address.trim(),

            primaryContactName: primaryContactName.trim(),
            primaryContactPhone: primaryContactPhone.trim(),
            primaryContactEmail: cleanEmail,

            ownerEmail: cleanEmail,
            fullName: primaryContactName.trim(),
            email: cleanEmail,

            requestedByUid: cred.user.uid,
            createdAt: serverTimestamp(),
          });

          console.log("✅ orgRegistration accessRequest created for", cleanEmail, "orgId:", orgId);
        } catch (e: any) {
          console.error("❌ orgRegistration accessRequest FAILED:", e);
          setMsg(`❌ Registration request failed: ${e?.message || String(e)}`);
          return;
        }

        await signOut(auth);
        setMsg("✅ Registration submitted. Super Admin will activate your account.");
        setMode("login");
        setEmail("");
        setPassword("");
        setOrgName("");
        setRequestedTier("COMM_L1");
        setWebsite("");
        setAddress("");
        setPrimaryContactName("");
        setPrimaryContactPhone("");
      }
    } catch (err: any) {
      const code = err?.code ? String(err.code) : "";
      const message = err?.message ? String(err.message) : "Unknown error";

      // friendlier messages for common auth issues
      if (code.includes("auth/invalid-email")) setMsg("❌ Invalid email. Remove spaces and try again.");
      else if (code.includes("auth/email-already-in-use")) setMsg("❌ Email already in use. Try Login instead.");
      else if (code.includes("auth/wrong-password")) setMsg("❌ Wrong password.");
      else if (code.includes("auth/user-not-found")) setMsg("❌ No account found. Try Register instead.");
      else setMsg(`❌ ${message}`);
    } finally {
      setBusy(false);
    }
  }




return (
  <div className="px-6">
    <div className="max-w-6xl mx-auto mt-20 flex flex-col lg:flex-row gap-8 items-start justify-center">
      
      {/* LEFT: Login Card (keeps existing logic) */}
      <div className="w-full lg:flex-1">
        <div
          style={{
            background: "#fff",
            border: "1px solid rgba(15,23,42,.10)",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(15,23,42,.08)",
            padding: 22,
          }}
        >
          <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 700, marginBottom: 14 }}>
            {mode === "login" ? "Login (Email/Password)" : "Register (Email/Password)"}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={busy}
              style={{
                padding: 12,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "#eaf2ff",
                outline: "none",
                fontSize: 14,
              }}
            />

            <input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              disabled={busy}
              style={{
                padding: 12,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "#eaf2ff",
                outline: "none",
                fontSize: 14,
              }}
            />
            {mode === "register" && (
              <div style={{ display: "grid", gap: 12, marginTop: 6 }}>
                <div style={{ height: 1, background: "#e2e8f0" }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Company Registration</div>

                <input
                  placeholder="Company Name *"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={busy}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    outline: "none",
                    fontSize: 14,
                  }}
                />

                <select
                  value={requestedTier}
                  onChange={(e) => setRequestedTier(e.target.value as any)}
                  disabled={busy}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    outline: "none",
                    fontSize: 14,
                  }}
                >
                  <option value="SPONSORED">SPONSORED (1 user)</option>
                  <option value="COMM_L1">COMM_L1 (Level 1)</option>
                  <option value="COMM_L2">COMM_L2 (Level 2)</option>
                </select>

                <input
                  placeholder="Website (optional)"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  disabled={busy}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    outline: "none",
                    fontSize: 14,
                  }}
                />

                <input
                  placeholder="Address (optional)"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={busy}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    outline: "none",
                    fontSize: 14,
                  }}
                />

                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>Primary Contact</div>

                <input
                  placeholder="Full Name *"
                  value={primaryContactName}
                  onChange={(e) => setPrimaryContactName(e.target.value)}
                  disabled={busy}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    outline: "none",
                    fontSize: 14,
                  }}
                />

                <input
                  placeholder="Phone (optional)"
                  value={primaryContactPhone}
                  onChange={(e) => setPrimaryContactPhone(e.target.value)}
                  disabled={busy}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    outline: "none",
                    fontSize: 14,
                  }}
                />

                <div style={{ fontSize: 12, color: "#64748b" }}>
                  After you submit, an Admin will approve your registration and activate your org.
                </div>
              </div>
            )}


            <button
              type="submit"
              disabled={busy}
              style={{
                marginTop: 6,
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,.10)",
                background: "#fff",
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.7 : 1,
                fontWeight: 700,
              }}
            >
              {busy ? "Please wait..." : mode === "login" ? "Login" : "Register"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMsg("");
                setMode(mode === "login" ? "register" : "login");
              }}
              disabled={busy}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "none",
                background: "transparent",
                color: "#0f172a",
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.7 : 1,
              }}
            >
              Switch to {mode === "login" ? "Register" : "Login"}
            </button>

            {msg && <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{msg}</div>}

            {/* keep your existing hint */}
            <div style={{ fontSize: 12, color: "#666" }}>
              Submitting email as: <code>{cleanEmail || "—"}</code>
            </div>
          </form>
        </div>
      </div>

      {/* RIGHT: How it works (reused component) */}
      <div className="w-full lg:flex-1">
        <HowItWorksPanel />
      </div>

    </div>
  </div>
);





}
