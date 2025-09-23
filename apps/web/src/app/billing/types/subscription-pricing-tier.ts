export const PersonalSubscriptionPricingTierIds = {
  Premium: "premium",
  Families: "families",
} as const;

export const BusinessSubscriptionPricingTierIds = {
  Free: "free",
  Teams: "teams",
  Enterprise: "enterprise",
  Custom: "custom",
} as const;

export const SubscriptionCadenceIds = {
  Annually: "annually",
  Monthly: "monthly",
} as const;

export type PersonalSubscriptionPricingTierId =
  (typeof PersonalSubscriptionPricingTierIds)[keyof typeof PersonalSubscriptionPricingTierIds];
export type BusinessSubscriptionPricingTierId =
  (typeof BusinessSubscriptionPricingTierIds)[keyof typeof BusinessSubscriptionPricingTierIds];
export type SubscriptionCadence =
  (typeof SubscriptionCadenceIds)[keyof typeof SubscriptionCadenceIds];

type HasFeatures = {
  features: { key: string; value: string }[];
};

type HasAdditionalStorage = {
  annualPricePerAdditionalStorageGB: number;
};

type StandalonePasswordManager = HasFeatures &
  HasAdditionalStorage & {
    type: "standalone";
    annualPrice: number;
  };

type PackagedPasswordManager = HasFeatures &
  HasAdditionalStorage & {
    type: "packaged";
    users: number;
    annualPrice: number;
  };

type FreePasswordManager = HasFeatures & {
  type: "free";
};

type CustomPasswordManager = HasFeatures & {
  type: "custom";
};

type ScalablePasswordManager = HasFeatures &
  HasAdditionalStorage & {
    type: "scalable";
    annualPricePerUser: number;
  };

type FreeSecretsManager = HasFeatures & {
  type: "free";
};

type ScalableSecretsManager = HasFeatures & {
  type: "scalable";
  annualPricePerUser: number;
  annualPricePerAdditionalServiceAccount: number;
};

export type PersonalSubscriptionPricingTier = {
  id: PersonalSubscriptionPricingTierId;
  name: string;
  description: string;
  availableCadences: Omit<SubscriptionCadence, "monthly">[]; // personal plans are only ever annual
  passwordManager: StandalonePasswordManager | PackagedPasswordManager;
};

export type BusinessSubscriptionPricingTier = {
  id: BusinessSubscriptionPricingTierId;
  name: string;
  description: string;
  availableCadences: SubscriptionCadence[];
  passwordManager: FreePasswordManager | ScalablePasswordManager | CustomPasswordManager;
  secretsManager?: FreeSecretsManager | ScalableSecretsManager;
};
