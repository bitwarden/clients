import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { ServiceContainer } from "../../service-container";
import { SmAccessPolicyResponse } from "../models/sm-access-policy.response";
import { checkSmRequestOrganization, parseSmId, parseSmRequest } from "../sm-command.utils";

import {
  checkSmAccessPolicy,
  fromSmPermission,
  isSmGranteeTypeFor,
  parseSmAccessTarget,
  parseSmPermission,
  smAccessGranteeTypes,
  SmAccessPolicy,
  SmAccessPolicyStore,
  SmAccessTarget,
} from "./sm-access-policies";

type SmAccessSetRequest = {
  organizationId: string;
  policies: unknown;
};

/**
 * Replaces every access policy on the target with the policies in the request.
 */
export class AccessSetCommand {
  constructor(private store: SmAccessPolicyStore) {}

  async run(
    organizationId: string,
    target: string,
    targetId: string,
    requestJson: unknown,
  ): Promise<Response> {
    const parsedTarget = parseSmAccessTarget(target);
    if (parsedTarget.error) {
      return parsedTarget.error;
    }
    const parsed = await parseSmRequest<SmAccessSetRequest>(requestJson);
    if (parsed.error) {
      return parsed.error;
    }
    const policies = this.readPolicies(parsedTarget.target, parsed.request.policies);
    if (policies.error) {
      return policies.error;
    }

    const loaded = await this.store.load(organizationId, target, targetId);
    if (loaded.error) {
      return loaded.error;
    }
    const orgMismatch = checkSmRequestOrganization(
      loaded.state.organizationId,
      parsed.request.organizationId,
    );
    if (orgMismatch) {
      return orgMismatch;
    }

    const saved = await this.store.save(loaded.state, policies.policies);
    if (saved.error) {
      return saved.error;
    }
    return Response.success(
      new ListResponse(saved.policies.map((p) => new SmAccessPolicyResponse(p))),
    );
  }

  private readPolicies(
    target: SmAccessTarget,
    value: unknown,
  ): { policies: SmAccessPolicy[]; error?: undefined } | { policies?: undefined; error: Response } {
    if (!Array.isArray(value)) {
      return { error: Response.badRequest("`policies` must be an array.") };
    }

    const policies: SmAccessPolicy[] = [];
    for (const item of value) {
      if (item == null || typeof item !== "object" || Array.isArray(item)) {
        return { error: Response.badRequest("Each policy must be a JSON object.") };
      }
      const { type, id, permission } = item as Record<string, unknown>;
      if (!isSmGranteeTypeFor(target, type)) {
        return {
          error: Response.badRequest(
            "Each policy's `type` must be one of: " + smAccessGranteeTypes(target).join(", ") + ".",
          ),
        };
      }
      const parsedId = parseSmId(typeof id === "string" ? id : undefined, "id");
      if (parsedId.error) {
        return { error: parsedId.error };
      }
      const parsedPermission = parseSmPermission(permission);
      if (parsedPermission.error) {
        return { error: parsedPermission.error };
      }
      const invalid = checkSmAccessPolicy(target, type, parsedPermission.permission);
      if (invalid) {
        return { error: invalid };
      }
      if (policies.some((p) => p.type === type && p.id === parsedId.id)) {
        return {
          error: Response.badRequest("`" + parsedId.id + "` is listed more than once."),
        };
      }
      policies.push({ type, id: parsedId.id, ...fromSmPermission(parsedPermission.permission) });
    }
    return { policies };
  }

  static create(serviceContainer: ServiceContainer) {
    return new AccessSetCommand(SmAccessPolicyStore.create(serviceContainer));
  }
}
