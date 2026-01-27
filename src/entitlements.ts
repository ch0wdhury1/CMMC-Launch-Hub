export type Entitlements = Record<string, boolean>;

export function hasEntitlement(ent: Entitlements | null | undefined, key: string) {
  return !!ent && ent[key] === true;
}

