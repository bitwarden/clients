export const PolicyCategory = {
  DataControl: "data-controls",
  Authentication: "authentication",
  VaultManagement: "vault-management",
} as const;

export type PolicyCategory = (typeof PolicyCategory)[keyof typeof PolicyCategory];
