import type { AccessRuleView } from "@bitwarden/sdk-internal";

import { isoDate, PamObject, PamResponse } from "../shared";

/** The text of a free-form field is cleaned by the caller with `sanitizeUntrusted`. */
function ids(values: readonly unknown[]): string[] {
  return values.map((v) => String(v));
}

/**
 * An access rule, flat. The conditions are written as `requiresHumanApproval` and `ipAllowlist`,
 * so the object round-trips only through the request JSON of `rule template`, not through this
 * shape. Collections are ids; names are added only for `--names`.
 */
export class RuleResponse extends PamResponse {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  enabled: boolean;
  requiresHumanApproval: boolean;
  ipAllowlist: string[];
  /** Conditions of a kind this CLI does not know, which a newer server may add. */
  unknownConditions: number;
  singleActiveLease: boolean;
  defaultLeaseDurationSeconds?: number;
  maxLeaseDurationSeconds?: number;
  allowsExtensions: boolean;
  maxExtensionDurationSeconds?: number;
  collectionIds: string[];
  /** Parallel to `collectionIds`, present only for `--names`. */
  collectionNames?: string[];
  creationDate?: string;
  revisionDate?: string;
  /**
   * Set by a write that can open bypass paths (disable or update): the collections that now give
   * access without a lease. Absent when it was not read.
   */
  bypassableCollectionIds?: string[];

  constructor(
    rule: AccessRuleView,
    text: { name: string; description?: string },
    collectionNames?: string[],
    bypassable?: string[],
  ) {
    super(PamObject.Rule);
    this.id = String(rule.id);
    this.organizationId = String(rule.organizationId);
    this.name = text.name;
    this.description = text.description;
    this.enabled = rule.enabled;
    this.requiresHumanApproval = rule.conditions.some((c) => c.kind === "human_approval");
    this.ipAllowlist = rule.conditions.flatMap((c) => (c.kind === "ip_allowlist" ? c.cidrs : []));
    this.unknownConditions = rule.conditions.filter((c) => c.kind === "unknown").length;
    this.singleActiveLease = rule.singleActiveLease;
    this.defaultLeaseDurationSeconds = rule.defaultLeaseDurationSeconds ?? undefined;
    this.maxLeaseDurationSeconds = rule.maxLeaseDurationSeconds ?? undefined;
    this.allowsExtensions = rule.allowsExtensions;
    this.maxExtensionDurationSeconds = rule.maxExtensionDurationSeconds ?? undefined;
    this.collectionIds = ids(rule.collections);
    this.collectionNames = collectionNames;
    this.creationDate = isoDate(rule.creationDate as unknown as string);
    this.revisionDate = isoDate(rule.revisionDate as unknown as string);
    this.bypassableCollectionIds = bypassable;
  }
}

/** The result of `rule bypassable`. */
export class RuleBypassableResponse extends PamResponse {
  ruleId: string;
  organizationId: string;
  collectionIds: string[];
  collectionNames?: string[];

  constructor(
    organizationId: string,
    ruleId: string,
    collectionIds: string[],
    collectionNames?: string[],
  ) {
    super("pam-rule-bypassable");
    this.ruleId = ruleId;
    this.organizationId = organizationId;
    this.collectionIds = collectionIds;
    this.collectionNames = collectionNames;
  }
}

/** The result of `rule delete`. */
export class RuleDeletedResponse extends PamResponse {
  id: string;
  organizationId: string;
  deleted = true;
  /** The rule's own collections, which are no longer gated. */
  ungovernedCollectionIds: string[];
  /** Collections that already gave access to the rule's ciphers without a lease. */
  bypassableCollectionIds?: string[];

  constructor(
    organizationId: string,
    id: string,
    ungoverned: string[],
    bypassable: string[] | undefined,
  ) {
    super("pam-rule-deleted");
    this.id = id;
    this.organizationId = organizationId;
    this.ungovernedCollectionIds = ungoverned;
    this.bypassableCollectionIds = bypassable;
  }
}

/** One entry of `rule validate-cidr`. */
export class CidrCheckResponse extends PamResponse {
  cidr: string;
  valid: boolean;

  constructor(cidr: string, valid: boolean) {
    super("pam-cidr-check");
    this.cidr = cidr;
    this.valid = valid;
  }
}
