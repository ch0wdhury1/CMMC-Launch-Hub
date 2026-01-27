import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";

export function useUserProfile() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [track, setTrack] = useState<string | null>(null);

  // Track auth user locally so we don't build doc refs with unstable auth.currentUser
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
    });
    return () => unsub();
  }, []);

  const userRef = useMemo(() => {
    if (!uid) return null;
    return doc(db, "users", uid);
  }, [uid]);

  useEffect(() => {
    // No user → stop
    if (!userRef) {
      setProfile(null);
      setTier(null);
      setTrack(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        setProfile(data);
        setTier((data as any)?.tier ?? null);
        setTrack((data as any)?.track ?? null);
        setLoading(false);
      },
      (e) => {
        console.error("user profile snapshot error:", e);
        setProfile(null);
        setTier(null);
        setTrack(null);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [userRef]);

  return { loading, profile, tier, track };
}
