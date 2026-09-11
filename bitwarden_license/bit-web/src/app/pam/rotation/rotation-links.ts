/** The rotation feature's tab segments, shared by the route table and every link into it. */
export const ROTATION_TABS = {
  accessConnectors: "access-connectors",
  targetSystems: "target-systems",
  managedCredentials: "managed-credentials",
} as const;

/** An absolute router link into the rotation feature, which is lazy-loaded under an organization. */
export function rotationLink(organizationId: string, ...rest: readonly string[]): string[] {
  return ["/organizations", organizationId, "pam", "rotation", ...rest];
}
