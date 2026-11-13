import { UserId } from "@bitwarden/common/types/guid";
import type {
  AccessRuleAddEditRequest,
  AccessRuleId,
  AccessRuleView,
  CollectionId,
  OrganizationId,
} from "@bitwarden/sdk-internal";

import { toSdkId } from "../shared/pam-ids";
import { PamInputError } from "../shared/pam-input-error";
import { PamSdkService } from "../shared/pam-sdk.service";

/** An access rule write and the collections it leaves reachable without a lease. */
export interface AccessRuleWriteResult {
  rule: AccessRuleView;
  /** False when the rule already was in the requested state and nothing was written. */
  changed: boolean;
  /**
   * Collection ids that now give access to the rule's ciphers without a lease, or `undefined`
   * when they could not be read. The write has landed either way.
   */
  bypassable: string[] | undefined;
}

/** What an update takes away from a rule's governance. Empty `weakenings` means it takes nothing away. */
export interface AccessRuleUpdateImpact {
  /** Human-readable reasons, one per way the update weakens the rule. */
  weakenings: string[];
  /** Collections that stop being governed: the removed ones, or all of them when the rule is disabled. */
  ungoverned: string[];
  /** True when the request equals the current rule, so there is nothing to write. */
  unchanged: boolean;
}

/** An update, or the weakenings it needs confirmation for before anything is written. */
export type AccessRuleUpdateResult =
  | { needsConfirmation: AccessRuleUpdateImpact }
  | (AccessRuleWriteResult & { ungoverned: string[] });

function conditionKey(condition: { kind: string; cidrs?: readonly string[] }): string {
  return condition.kind === "ip_allowlist"
    ? `ip_allowlist:${[...(condition.cidrs ?? [])]
        .map((c) => c.toLowerCase())
        .sort()
        .join(",")}`
    : condition.kind;
}

/**
 * Compares `request` with the rule it replaces. An update weakens governance when it disables the
 * rule, drops a collection, or removes or loosens a condition: a human approval that is gone, an
 * allowlist that is gone or admits a range the old one did not, or a kind this CLI cannot carry
 * over. Other changes, such as lease durations, are not judged.
 */
export function assessRuleUpdate(
  current: AccessRuleView,
  request: AccessRuleAddEditRequest,
): AccessRuleUpdateImpact {
  const weakenings: string[] = [];
  const currentCollections = current.collections.map((c) => String(c).toLowerCase());
  const requested = new Set(request.collections.map((c) => String(c).toLowerCase()));
  const removed = currentCollections.filter((c) => !requested.has(c));
  const disables = current.enabled && !request.enabled;

  if (disables) {
    weakenings.push("disables the rule");
  }
  if (removed.length > 0) {
    weakenings.push(`removes ${removed.length} collection(s) from the rule`);
  }

  const requestedAllowlists = request.conditions.flatMap((c) =>
    c.kind === "ip_allowlist" ? [new Set(c.cidrs.map((x) => x.toLowerCase()))] : [],
  );
  const requestedHumanApproval = request.conditions.some((c) => c.kind === "human_approval");
  const loosened = current.conditions.some((c) => {
    if (c.kind === "human_approval") {
      return !requestedHumanApproval;
    }
    if (c.kind === "ip_allowlist") {
      const old = new Set(c.cidrs.map((x) => x.toLowerCase()));
      return !requestedAllowlists.some((list) => [...list].every((cidr) => old.has(cidr)));
    }
    return true;
  });
  if (loosened) {
    weakenings.push("removes or loosens a condition");
  }

  const same =
    current.name === request.name &&
    (current.description ?? undefined) === (request.description ?? undefined) &&
    current.enabled === request.enabled &&
    current.singleActiveLease === request.singleActiveLease &&
    (current.defaultLeaseDurationSeconds ?? undefined) ===
      (request.defaultLeaseDurationSeconds ?? undefined) &&
    (current.maxLeaseDurationSeconds ?? undefined) ===
      (request.maxLeaseDurationSeconds ?? undefined) &&
    current.allowsExtensions === request.allowsExtensions &&
    (current.maxExtensionDurationSeconds ?? undefined) ===
      (request.maxExtensionDurationSeconds ?? undefined) &&
    [...requested].sort().join() === [...new Set(currentCollections)].sort().join() &&
    current.conditions.map(conditionKey).sort().join("|") ===
      request.conditions.map(conditionKey).sort().join("|");

  return {
    weakenings,
    ungoverned: disables ? currentCollections : removed,
    unchanged: same,
  };
}

/**
 * The collections of `request` that another rule already governs, as `[collectionId, ruleId]`.
 * A collection is governed by at most one rule, so a create or update that names one would be
 * refused by the server. `exceptRuleId` skips the rule being updated.
 */
export function findGovernedCollections(
  rules: readonly AccessRuleView[],
  collections: readonly string[],
  exceptRuleId?: string,
): [string, string][] {
  const wanted = new Set(collections.map((c) => c.toLowerCase()));
  const found: [string, string][] = [];
  for (const rule of rules) {
    if (exceptRuleId != null && String(rule.id).toLowerCase() === exceptRuleId.toLowerCase()) {
      continue;
    }
    for (const collection of rule.collections) {
      const id = String(collection).toLowerCase();
      if (wanted.has(id)) {
        found.push([id, String(rule.id).toLowerCase()]);
      }
    }
  }
  return found;
}

/**
 * Access rule operations over the SDK's `access_rules()` client. The server is the authority on
 * every refusal; this only adds the cheap local conflict check and the bypass read.
 */
export class AccessRulesService {
  constructor(private pam: PamSdkService) {}

  async list(userId: UserId, organizationId: string): Promise<AccessRuleView[]> {
    const org = toSdkId<OrganizationId>(organizationId, "organization id");
    return await this.pam.run(userId, (pam) => pam.access_rules().list(org));
  }

  async get(userId: UserId, organizationId: string, ruleId: string): Promise<AccessRuleView> {
    const org = toSdkId<OrganizationId>(organizationId, "organization id");
    const id = toSdkId<AccessRuleId>(ruleId, "rule id");
    return await this.pam.run(userId, (pam) => pam.access_rules().get(org, id));
  }

  /** The collections that expose the rule's ciphers without a lease. A missing rule answers empty. */
  async bypassable(userId: UserId, organizationId: string, ruleId: string): Promise<string[]> {
    const org = toSdkId<OrganizationId>(organizationId, "organization id");
    const id = toSdkId<AccessRuleId>(ruleId, "rule id");
    const ids = await this.pam.run(userId, (pam) => pam.access_rules().bypassable_ciphers(org, id));
    return ids.map((c) => String(c));
  }

  /**
   * Creates a rule. Refuses locally when a collection is already governed by another rule, using
   * the current list; if the list cannot be read the server decides.
   */
  async create(
    userId: UserId,
    organizationId: string,
    request: AccessRuleAddEditRequest,
  ): Promise<AccessRuleView> {
    const org = toSdkId<OrganizationId>(organizationId, "organization id");
    await this.refuseGovernedCollections(userId, organizationId, request.collections);
    return await this.pam.run(userId, (pam) => pam.access_rules().create(org, request));
  }

  /**
   * Updates a rule, replacing its whole collection set, then reads the bypass paths. The current
   * rule is read first: an identical request writes nothing, and one that weakens governance
   * (see `assessRuleUpdate`) is returned as `needsConfirmation` unless `confirmed`, with nothing
   * written.
   */
  async update(
    userId: UserId,
    organizationId: string,
    ruleId: string,
    request: AccessRuleAddEditRequest,
    confirmed: boolean,
  ): Promise<AccessRuleUpdateResult> {
    const org = toSdkId<OrganizationId>(organizationId, "organization id");
    const id = toSdkId<AccessRuleId>(ruleId, "rule id");
    const current = await this.get(userId, organizationId, ruleId);
    const impact = assessRuleUpdate(current, request);
    if (impact.unchanged) {
      return { rule: current, changed: false, bypassable: undefined, ungoverned: [] };
    }
    await this.refuseGovernedCollections(userId, organizationId, request.collections, ruleId);
    if (impact.weakenings.length > 0 && !confirmed) {
      return { needsConfirmation: impact };
    }
    const rule = await this.pam.run(userId, (pam) => pam.access_rules().update(org, id, request));
    return {
      rule,
      changed: true,
      bypassable: await this.tryBypassable(userId, organizationId, ruleId),
      ungoverned: impact.ungoverned,
    };
  }

  /** Enables a rule, after reading it. Does nothing when it is already enabled. */
  async enable(userId: UserId, organizationId: string, ruleId: string): Promise<AccessRuleView> {
    const org = toSdkId<OrganizationId>(organizationId, "organization id");
    const current = await this.get(userId, organizationId, ruleId);
    if (current.enabled) {
      return current;
    }
    return await this.pam.run(userId, (pam) => pam.access_rules().set_enabled(org, current, true));
  }

  /**
   * Disables a rule, after reading it, then reads the bypass paths: a disabled rule no longer
   * gates its collections. Does nothing when it is already disabled.
   */
  async disable(
    userId: UserId,
    organizationId: string,
    ruleId: string,
  ): Promise<AccessRuleWriteResult> {
    const org = toSdkId<OrganizationId>(organizationId, "organization id");
    const current = await this.get(userId, organizationId, ruleId);
    if (!current.enabled) {
      return { rule: current, changed: false, bypassable: undefined };
    }
    const rule = await this.pam.run(userId, (pam) =>
      pam.access_rules().set_enabled(org, current, false),
    );
    return {
      rule,
      changed: true,
      bypassable: await this.tryBypassable(userId, organizationId, ruleId),
    };
  }

  /**
   * Hard-deletes a rule. The bypass paths are read before the delete, because a deleted rule
   * answers empty. `ungoverned` is the rule's own collections, which stop being gated.
   */
  async delete(
    userId: UserId,
    organizationId: string,
    ruleId: string,
  ): Promise<{ bypassable: string[] | undefined; ungoverned: string[] }> {
    const org = toSdkId<OrganizationId>(organizationId, "organization id");
    const id = toSdkId<AccessRuleId>(ruleId, "rule id");
    const current = await this.get(userId, organizationId, ruleId);
    const bypassable = await this.tryBypassable(userId, organizationId, ruleId);
    await this.pam.run(userId, (pam) => pam.access_rules().delete(org, id));
    return { bypassable, ungoverned: current.collections.map((c: CollectionId) => String(c)) };
  }

  private async tryBypassable(
    userId: UserId,
    organizationId: string,
    ruleId: string,
  ): Promise<string[] | undefined> {
    try {
      return await this.bypassable(userId, organizationId, ruleId);
    } catch {
      // The write already landed, so a failed read is a missing warning, not a failed command.
      return undefined;
    }
  }

  private async refuseGovernedCollections(
    userId: UserId,
    organizationId: string,
    collections: readonly CollectionId[],
    exceptRuleId?: string,
  ): Promise<void> {
    if (collections.length === 0) {
      return;
    }
    let rules: AccessRuleView[];
    try {
      rules = await this.list(userId, organizationId);
    } catch {
      return;
    }
    const governed = findGovernedCollections(
      rules,
      collections.map((c) => String(c)),
      exceptRuleId,
    );
    if (governed.length > 0) {
      const lines = governed.map(([collection, rule]) => `collection ${collection} (rule ${rule})`);
      throw new PamInputError(
        `One or more collections are already governed by another access rule: ${lines.join(", ")}. A collection can have one rule.`,
      );
    }
  }
}
