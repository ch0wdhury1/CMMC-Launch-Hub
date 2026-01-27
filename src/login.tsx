import { useMemo, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "./firebase";
import { bootstrapUserProfile } from "./bootstrapUserProfile";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);

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
        await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await bootstrapUserProfile(); // ensures /users/{uid} exists
        setMsg("✅ Registered + logged in");
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
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 20, border: "1px solid #ddd", borderRadius: 12 }}>
      <h2 style={{ marginBottom: 10 }}>CMMC Launch Hub</h2>
      <p style={{ marginTop: 0, color: "#555" }}>
        {mode === "login" ? "Login" : "Create account"} (Email/Password)
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />

        <input
          placeholder="Password (6+ chars)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />

        <button
          type="submit"
          disabled={busy}
          style={{ padding: 10, borderRadius: 8, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }}
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
          style={{ padding: 10, borderRadius: 8, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }}
        >
          Switch to {mode === "login" ? "Register" : "Login"}
        </button>

        {msg && <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{msg}</div>}

        {/* tiny hint so you can visually confirm what we are submitting */}
        <div style={{ fontSize: 12, color: "#666" }}>
          Submitting email as: <code>{cleanEmail || "—"}</code>
        </div>
      </form>
    </div>
  );
}
