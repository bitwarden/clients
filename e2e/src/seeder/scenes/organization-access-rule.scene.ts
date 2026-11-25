import { SceneTemplate } from "../scene";

/** See `OrganizationAccessRuleScene.Request` in the server's util/Seeder/Scenes. */
export type OrganizationAccessRuleArgs = {
  organizationId: string;
  /** Not mangled. */
  name: string;
  description?: string;
  /** On when unset. */
  enabled?: boolean;
  /** Collections the rule governs. Each may be governed by one rule only. */
  collectionIds?: string[];
  ipAllowlistCidrs?: string[];
  requireHumanApproval?: boolean;
  singleActiveLease?: boolean;
  defaultLeaseDurationSeconds?: number;
  maxLeaseDurationSeconds?: number;
  allowsExtensions?: boolean;
  maxExtensionDurationSeconds?: number;
};

/** See `OrganizationAccessRuleScene.Result` in the server's util/Seeder/Scenes. */
export type OrganizationAccessRuleResult = {
  accessRuleId: string;
};

/** A PAM access rule governing collections. With no conditions it auto-approves requests. */
export class OrganizationAccessRuleScene extends SceneTemplate<
  OrganizationAccessRuleArgs,
  OrganizationAccessRuleResult
> {
  readonly template = "OrganizationAccessRuleScene";
}
