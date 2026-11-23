import { SceneTemplate } from "../scene";

import { GatewayType } from "./single-user.scene";

/** The server's `Bit.Core.Billing.Enums.PlanType`, which the SeederApi reads as numbers. */
export const PlanType = Object.freeze({
  Free: 0,
  FamiliesAnnually: 22,
  TeamsMonthly: 17,
  TeamsAnnually: 18,
  EnterpriseMonthly: 19,
  EnterpriseAnnually: 20,
} as const);
export type PlanType = (typeof PlanType)[keyof typeof PlanType];

/**
 * Overrides applied on top of the plan's features, see `OrganizationOverrides` in the server's
 * util/Seeder/Options. Unset leaves the plan's value.
 */
export type OrganizationOverrides = {
  usePam?: boolean;
  useEvents?: boolean;
  useGroups?: boolean;
  useCustomPermissions?: boolean;
  allowAdminAccessToAllCollectionItems?: boolean;
};

/** See `SingleOrganizationScene.Request` in the server's util/Seeder/Scenes. */
export type SingleOrganizationArgs = {
  /** A seeded user, e.g. `SingleUserScene`'s `userId`, who becomes the confirmed owner. */
  ownerUserId: string;
  planType: PlanType;
  /** Mangled by the server. */
  name: string;
  /** Mangled by the server. */
  domain: string;
  seats: number;
  overrides?: OrganizationOverrides;
  /** Billing gateway identity. No Stripe calls are made. */
  gateway?: GatewayType;
};

/** See `SingleOrganizationSceneResult` in the server's util/Seeder/Scenes. */
export type SingleOrganizationResult = {
  organizationId: string;
  /** The owner's membership. */
  organizationUserId: string;
  apiKey: string;
  /** The organization key, base64, which collection and member scenes encrypt with. */
  organizationKeyB64: string;
};

/** An organization on a plan, owned by an existing user. */
export class SingleOrganizationScene extends SceneTemplate<
  SingleOrganizationArgs,
  SingleOrganizationResult
> {
  readonly template = "SingleOrganizationScene";
}
