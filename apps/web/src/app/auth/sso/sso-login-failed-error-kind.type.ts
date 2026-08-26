/**
 * SSO-login failure kinds rendered by `SsoLoginFailedComponent`. Values are
 * the string identifiers passed as the `kind` query param on the route.
 */
export const SsoLoginFailedErrorKind = Object.freeze({
  StagedOrgUserDirectInviteSent: "staged-org-user-direct-invite-sent",
  NoSeatsAvailable: "no-seats-available",
} as const);

export type SsoLoginFailedErrorKind =
  (typeof SsoLoginFailedErrorKind)[keyof typeof SsoLoginFailedErrorKind];

export function isSsoLoginFailedErrorKind(value: unknown): value is SsoLoginFailedErrorKind {
  return (
    typeof value === "string" &&
    (Object.values(SsoLoginFailedErrorKind) as string[]).includes(value)
  );
}
