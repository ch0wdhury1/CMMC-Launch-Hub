import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";

export type OrgMember = {
  role?: "admin" | "member";
  superAdmin?: boolean;
  createdAt?: any;
};

export function useOrgMember(orgId?: string) {
  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<OrgMember | null>(null);
  const [error, setError] = useState<unknown>(null);

  // ✅ Track auth state reliably
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // ✅ Only build the ref once auth is ready AND orgId is valid
  const memberRef = useMemo(() => {
    if (!authReady) return null;
    if (!uid) return null;
    if (!orgId || typeof orgId !== "string" || orgId.trim() === "") return null;
    return doc(db, "orgs", orgId.trim(), "members", uid);
  }, [authReady, orgId, uid]);

  useEffect(() => {
    setError(null);

    // Not ready yet → show "loading" until auth finishes
    if (!authReady) {
      setLoading(true);
      setMember(null);
      return;
    }

    // Auth ready but no uid/orgId → not an error, just no membership context
    if (!memberRef) {
      setLoading(false);
      setMember(null);
      return;
    }

    setLoading(true);

    const unsub = onSnapshot(
      memberRef,
      (snap) => {
        setMember(snap.exists() ? (snap.data() as OrgMember) : null);
        setLoading(false);
      },
      (e) => {
        console.error("org member snapshot error:", e);
        setError(e);
        setMember(null);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [authReady, memberRef]);

  return { loading, member, error, uid };
}
