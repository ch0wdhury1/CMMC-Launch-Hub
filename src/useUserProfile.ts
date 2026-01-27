import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";

type UserProfile = {
  tier?: string;
  track?: string;
  entitlements?: Record<string, any>;
  roles?: Record<string, any>;
};

export function useUserProfile() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [track, setTrack] = useState<string | null>(null);

  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  // 1) Keep UID stable via auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
    });
    return () => unsub();
  }, []);

  // 2) Only build doc ref when uid exists
  const userRef = useMemo(() => {
    if (!uid) return null;
    return doc(db, "users", uid);
  }, [uid]);

  // 3) Subscribe to the user doc
  useEffect(() => {
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
        const data = snap.exists() ? (snap.data() as UserProfile) : null;
        setProfile(data);
        setTier(data?.tier ?? null);
        setTrack(data?.track ?? null);
        setLoading(false);
      },
      (err) => {
        console.error("useUserProfile snapshot error:", err);
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
