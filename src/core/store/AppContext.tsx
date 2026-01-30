import React, { createContext, useContext, useMemo, useState } from "react";

export type Tier = "SPONSORED" | "COMM_L1" | "COMM_L2";

export type AppUser = {
  uid: string;
  email?: string;
  displayName?: string;
  orgId: string;
  roles?: {
    superAdmin?: boolean;
    orgRole?: "orgAdmin" | "member";
  };
  status?: "active" | "disabled";
};

export type Org = {
  id: string;
  name: string;
  tier: Tier;
  maxUsers?: number;
  activeMemberCount?: number;
  billingCycle?: "annual";
  subscriptionStatus?: "active" | "trial" | "past_due" | "canceled" | "expired";
  subscriptionStartDate?: any;
  subscriptionEndDate?: any;
};

export type Entitlements = {
  canAccessL1: boolean;
  canAccessL2: boolean;
  isAdminPanelAllowed: boolean;
};

type AppState = {
  loading: boolean;
  error?: string;
  user?: AppUser;
  org?: Org;
  tier?: Tier;
  entitlements?: Entitlements;
  // setters for bootstrap
  setLoading: (v: boolean) => void;
  setError: (v?: string) => void;
  setUser: (u?: AppUser) => void;
  setOrg: (o?: Org) => void;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [user, setUser] = useState<AppUser | undefined>();
  const [org, setOrg] = useState<Org | undefined>();

  const tier = org?.tier;

  const entitlements = useMemo<Entitlements | undefined>(() => {
    if (!user || !org) return undefined;

    // Subscription gate (simple MVP)
    const status = org.subscriptionStatus ?? "active";
    const end = org.subscriptionEndDate?.toDate ? org.subscriptionEndDate.toDate() : null;
    const expired = end ? end.getTime() < Date.now() : false;
    const subscriptionOk = status === "active" && !expired;

    const effectiveTier = subscriptionOk ? org.tier : "SPONSORED"; // lock-down behavior
    const canAccessL2 = effectiveTier === "COMM_L2";
    const canAccessL1 = true;

    const isSuperAdmin = user.roles?.superAdmin === true;
    return {
      canAccessL1,
      canAccessL2,
      isAdminPanelAllowed: isSuperAdmin,
    };
  }, [user, org]);

  const value: AppState = {
    loading,
    error,
    user,
    org,
    tier,
    entitlements,
    setLoading,
    setError,
    setUser,
    setOrg,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState must be used inside AppProvider");
  return v;
}



