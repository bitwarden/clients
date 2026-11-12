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

  /** Updates a rule, replacing its whole collection set, then reads the bypass paths. */
  async update(
    userId: UserId,
    organizationId: string,
    ruleId: string,
    request: AccessRuleAddEditRequest,
  ): Promise<AccessRuleWriteResult> {
    const org = toSdkId<OrganizationId>(organizationId, "organization id");
    const id = toSdkId<AccessRuleId>(ruleId, "rule id");
    await this.refuseGovernedCollections(userId, organizationId, request.collections, ruleId);
    const rule = await this.pam.run(userId, (pam) => pam.access_rules().update(org, id, request));
    return {
      rule,
      changed: true,
      bypassable: await this.tryBypassable(userId, organizationId, ruleId),
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
