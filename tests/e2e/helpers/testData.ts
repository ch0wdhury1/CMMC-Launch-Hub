export const uniqueEmail = (prefix: string) =>
  `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.test`;
export const uniqueOrgName = (prefix: string) =>
  `${prefix} ${Date.now()} ${Math.random().toString(36).slice(2, 7)}`;
