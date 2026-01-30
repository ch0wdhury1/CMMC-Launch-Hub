import { useEffect } from "react";
import { fetchOrg, fetchUserProfile } from "./org";
import { useAppState } from "../store/AppContext";

export function useLoadUserAndOrg(uid?: string) {
  const { setUser, setOrg, setError, setLoading } = useAppState();

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!uid) return;
      try {
        setLoading(true);
        setError(undefined);

        const user = await fetchUserProfile(uid);
        if (cancelled) return;
        setUser(user);

        const org = await fetchOrg(user.orgId);
        if (cancelled) return;
        setOrg(org);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Bootstrap failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [uid, setUser, setOrg, setError, setLoading]);
}



