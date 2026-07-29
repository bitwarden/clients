export const RevocationReasonType = Object.freeze({
  Unknown: 0,
  Manual: 1,
  TwoFactorPolicyNonCompliance: 2,
  OrganizationDataOwnershipPolicyNonCompliance: 3,
  SingleOrgPolicyNonCompliance: 4,
} as const);

export const RevocationReasonMessageMap: Record<RevocationReasonType, string> = {
  "0": "revocationReasonNotLogged",
  "1": "revocationReasonManual",
  "2": "revocationReasonTwoFactorNonCompliance",
  "3": "revocationReasonDeclinedItemTransfer",
  "4": "revocationReasonSingleOrganizationNonCompliance",
};

export type RevocationReasonType = (typeof RevocationReasonType)[keyof typeof RevocationReasonType];
