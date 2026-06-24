export type Entitlements = Record<string, boolean> | undefined;
export type Roles = Record<string, boolean> | undefined;

export function can(ent: Entitlements, key: string) {
  return !!ent && ent[key] === true;
}

export function isSuperAdmin(roles: Roles) {
  return !!roles && roles.superAdmin === true;
}

export function isProgramObserver(user: any) {
  return user?.roles?.pilotObserver === true || user?.roles?.programObserver === true;
}
