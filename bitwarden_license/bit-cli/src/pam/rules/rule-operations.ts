import { firstValueFrom } from "rxjs";

import {
  AccessRulesService,
  parseAccessRuleRequest,
  accessRuleTemplate,
} from "@bitwarden/bit-common/pam/rules";
import {
  PAM_IDS_ONLY,
  PamNames,
  sanitizeUntrusted,
  parseGuid,
} from "@bitwarden/bit-common/pam/shared";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { TemplateResponse } from "@bitwarden/cli/models/response/template.response";
import { UserId } from "@bitwarden/common/types/guid";
import type { AccessRuleView } from "@bitwarden/sdk-internal";

import { ServiceContainer } from "../../service-container";
import {
  checkOrganizationRequirement,
  createPamNameResolver,
  createPamSdkService,
  PamOrganizationRequirement,
} from "../shared";

import { isValidCidr } from "./cidr";
import {
  CidrCheckResponse,
  RuleBypassableResponse,
  RuleDeletedResponse,
  RuleResponse,
} from "./rule.response";

/**
 * The access rule commands as `Response`-returning operations, shared by the commander verbs and
 * the `bw serve` routes so both run the same code. Guards (flags, unlock, the write pre-check)
 * are the caller's job; the server stays the authority for everything else.
 *
 * The warnings carry collection ids only, never names or any vault data.
 */
export class RuleOperations {
  private service: AccessRulesService;

  constructor(private container: ServiceContainer) {
    this.service = new AccessRulesService(createPamSdkService(container));
  }

  /**
   * The refusal for a caller who cannot read access rules in `organizationId`, else `undefined`.
   * Reads need no admin right, only an organization that uses Privileged Controls, so an
   * organization without it is refused before any SDK call.
   */
  async refuseIfCannotRead(userId: UserId, organizationId: string): Promise<string | undefined> {
    return await this.refuse(userId, organizationId, PamOrganizationRequirement.UsePam);
  }

  /** The refusal for a caller who cannot write access rules in `organizationId`, else `undefined`. */
  async refuseIfCannotWrite(userId: UserId, organizationId: string): Promise<string | undefined> {
    return await this.refuse(userId, organizationId, PamOrganizationRequirement.ManageAccessRules);
  }

  private async refuse(
    userId: UserId,
    organizationId: string,
    requirement: PamOrganizationRequirement,
  ): Promise<string | undefined> {
    const organizations = await firstValueFrom(
      this.container.organizationService.organizations$(userId),
    );
    return checkOrganizationRequirement(
      organizations.find((o) => o.id === organizationId),
      requirement,
    );
  }

  template(): Response {
    return Response.success(new TemplateResponse(accessRuleTemplate()));
  }

  validateCidr(cidrs: readonly string[]): Response {
    const results = cidrs.map(
      (c) => new CidrCheckResponse(sanitizeUntrusted(c, 64), isValidCidr(c)),
    );
    const invalid = results.filter((r) => !r.valid);
    if (invalid.length > 0) {
      return Response.error(
        `Not a valid CIDR range: ${invalid.map((r) => r.cidr).join(", ")}. A CIDR needs a prefix and no host bits past it, such as 10.0.0.0/8.`,
        new ListResponse(results),
      );
    }
    return Response.success(new ListResponse(results));
  }

  async list(userId: UserId, organizationId: string, names: boolean): Promise<Response> {
    const rules = await this.service.list(userId, organizationId);
    const lookup = await this.lookup(names);
    return Response.success(new ListResponse(rules.map((r) => this.toResponse(r, lookup, names))));
  }

  async get(userId: UserId, organizationId: string, ruleId: string, names: boolean) {
    const rule = await this.service.get(userId, organizationId, ruleId);
    return Response.success(this.toResponse(rule, await this.lookup(names), names));
  }

  async create(userId: UserId, organizationId: string, input: unknown): Promise<Response> {
    const request = parseAccessRuleRequest(input, isValidCidr);
    const rule = await this.service.create(userId, organizationId, request);
    return Response.success(this.toResponse(rule, PAM_IDS_ONLY, false));
  }

  async update(
    userId: UserId,
    organizationId: string,
    ruleId: string,
    input: unknown,
  ): Promise<{ response: Response; bypassable?: string[]; changed: boolean }> {
    const request = parseAccessRuleRequest(input, isValidCidr);
    const { rule, bypassable, changed } = await this.service.update(
      userId,
      organizationId,
      ruleId,
      request,
    );
    return {
      response: Response.success(this.toResponse(rule, PAM_IDS_ONLY, false, bypassable)),
      bypassable,
      changed,
    };
  }

  async enable(userId: UserId, organizationId: string, ruleId: string): Promise<Response> {
    const rule = await this.service.enable(userId, organizationId, ruleId);
    return Response.success(this.toResponse(rule, PAM_IDS_ONLY, false));
  }

  async disable(
    userId: UserId,
    organizationId: string,
    ruleId: string,
  ): Promise<{ response: Response; bypassable?: string[]; changed: boolean }> {
    const { rule, bypassable, changed } = await this.service.disable(
      userId,
      organizationId,
      ruleId,
    );
    return {
      response: Response.success(this.toResponse(rule, PAM_IDS_ONLY, false, bypassable)),
      bypassable,
      changed,
    };
  }

  async delete(
    userId: UserId,
    organizationId: string,
    ruleId: string,
  ): Promise<{ response: Response; bypassable?: string[]; ungoverned: string[] }> {
    const { bypassable, ungoverned } = await this.service.delete(userId, organizationId, ruleId);
    return {
      response: Response.success(
        new RuleDeletedResponse(
          organizationId,
          parseGuid(ruleId, "rule id"),
          ungoverned,
          bypassable,
        ),
      ),
      bypassable,
      ungoverned,
    };
  }

  async bypassable(
    userId: UserId,
    organizationId: string,
    ruleId: string,
    names: boolean,
  ): Promise<Response> {
    const ids = await this.service.bypassable(userId, organizationId, ruleId);
    const lookup = await this.lookup(names);
    return Response.success(
      new RuleBypassableResponse(
        organizationId,
        parseGuid(ruleId, "rule id"),
        ids,
        names ? ids.map((id) => lookup.collection(id)) : undefined,
      ),
    );
  }

  private async lookup(names: boolean): Promise<PamNames> {
    return names ? await createPamNameResolver(this.container).load() : PAM_IDS_ONLY;
  }

  private toResponse(
    rule: AccessRuleView,
    lookup: PamNames,
    names: boolean,
    bypassable?: string[],
  ): RuleResponse {
    const ids = rule.collections.map((c) => String(c));
    return new RuleResponse(
      rule,
      {
        name: sanitizeUntrusted(rule.name, 256),
        description:
          rule.description == null ? undefined : sanitizeUntrusted(rule.description, 1000),
      },
      names ? ids.map((id) => sanitizeUntrusted(lookup.collection(id), 200)) : undefined,
      bypassable,
    );
  }
}

/**
 * The stderr text after a write that may leave collections reachable without a lease, or
 * `undefined` when nothing is exposed or the paths could not be read. Ids only.
 */
export function bypassWarning(
  action: "disabled" | "updated" | "deleted",
  bypassable: readonly string[] | undefined,
  ungoverned: readonly string[] = [],
): string | undefined {
  const exposed = [...new Set([...ungoverned, ...(bypassable ?? [])])];
  if (bypassable == null && ungoverned.length === 0) {
    return `Warning: the rule was ${action}, but the collections that now bypass leasing could not be read. Run \`bw pam rule bypassable\` to check.`;
  }
  if (exposed.length === 0) {
    return undefined;
  }
  const why =
    action === "deleted"
      ? "are no longer governed, so their ciphers need no lease"
      : "can give access to the rule's ciphers without a lease";
  return `Warning: the rule was ${action}. These collections ${why}: ${exposed.join(", ")}.`;
}
