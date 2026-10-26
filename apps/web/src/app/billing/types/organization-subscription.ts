export type OrganizationSubscriptionPlan = {
  tier: "families" | "teams" | "enterprise";
  cadence: "annually" | "monthly";
};

export type PrivilegedControlsSelection = {
  seatMinimum?: number;
};

export type OrganizationSubscriptionPurchase = OrganizationSubscriptionPlan & {
  passwordManager: {
    seats: number;
    additionalStorage: number;
    sponsored: boolean;
  };
  secretsManager?: {
    seats: number;
    additionalServiceAccounts: number;
    standalone: boolean;
  };
  privilegedControls?: PrivilegedControlsSelection;
};
