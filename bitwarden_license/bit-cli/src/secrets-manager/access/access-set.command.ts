import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { ServiceContainer } from "../../service-container";
import { SmAccessPolicyResponse } from "../models/sm-access-policy.response";
import {
  checkSmRequestOrganization,
  parseSmId,
  parseSmRequest,
  SmOrganization,
} from "../sm-command.utils";

import {
  checkSmAccessPolicy,
  fromSmPermission,
  isSmGranteeTypeFor,
  parseSmAccessTarget,
  parseSmPermission,
  smAccessGranteeTypes,
  SmAccessPermission,
  SmAccessPolicy,
  SmAccessPolicyStore,
  SmAccessTarget,
  toSmPermission,
} from "./sm-access-policies";

type SmAccessSetRequest = {
  organizationId: string;
  policies: unknown;
};

/**
 * A policy read from the request. `permission` is undefined when the request leaves it out.
 */
type SmAccessSetPolicy = {
  type: SmAccessPolicy["type"];
  id: string;
  permission?: SmAccessPermission;
};

/**
 * Applied to a grantee that has no access yet when the request leaves out `permission`.
 */
const DefaultPermission: SmAccessPermission = "read";

export class AccessSetCommand {
  constructor(private store: SmAccessPolicyStore) {}

  async run(
    org: SmOrganization,
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

    const loaded = await this.store.load(org, target, targetId);
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

    const resolved = this.resolvePermissions(
      parsedTarget.target,
      loaded.state.policies,
      policies.policies,
    );
    if (resolved.error) {
      return resolved.error;
    }

    const invalidGrantee = await this.store.checkNewGrantees(loaded.state, resolved.policies);
    if (invalidGrantee) {
      return invalidGrantee;
    }

    const saved = await this.store.save(loaded.state, resolved.policies);
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
  ):
    | { policies: SmAccessSetPolicy[]; error?: undefined }
    | { policies?: undefined; error: Response } {
    if (!Array.isArray(value)) {
      return { error: Response.badRequest("`policies` must be an array.") };
    }

    const policies: SmAccessSetPolicy[] = [];
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
      if (typeof id !== "string") {
        return { error: Response.badRequest("Each policy's `id` must be a string.") };
      }
      const parsedId = parseSmId(id, "id");
      if (parsedId.error) {
        return { error: parsedId.error };
      }
      let parsedPermission: SmAccessPermission | undefined;
      if (permission != null) {
        const parsed = parseSmPermission(permission);
        if (parsed.error) {
          return { error: parsed.error };
        }
        const invalid = checkSmAccessPolicy(target, type, parsed.permission);
        if (invalid) {
          return { error: invalid };
        }
        parsedPermission = parsed.permission;
      }
      if (policies.some((p) => p.type === type && p.id === parsedId.id)) {
        return {
          error: Response.badRequest("`" + parsedId.id + "` is listed more than once."),
        };
      }
      policies.push({ type, id: parsedId.id, permission: parsedPermission });
    }
    return { policies };
  }

  /**
   * Fills in each policy's permission. A policy without one keeps the permission its grantee
   * already has on the target, or gets the default permission if the grantee has no access yet.
   */
  private resolvePermissions(
    target: SmAccessTarget,
    current: SmAccessPolicy[],
    requested: SmAccessSetPolicy[],
  ): { policies: SmAccessPolicy[]; error?: undefined } | { policies?: undefined; error: Response } {
    const policies: SmAccessPolicy[] = [];
    for (const policy of requested) {
      if (policy.permission != null) {
        policies.push({
          type: policy.type,
          id: policy.id,
          ...fromSmPermission(policy.permission),
        });
        continue;
      }

      const existing = current.find(
        (p) => p.type === policy.type && p.id.toLowerCase() === policy.id,
      );
      if (existing) {
        policies.push({
          type: policy.type,
          id: policy.id,
          ...fromSmPermission(toSmPermission(existing)),
        });
        continue;
      }

      const invalid = checkSmAccessPolicy(target, policy.type, DefaultPermission);
      if (invalid) {
        return { error: invalid };
      }
      policies.push({ type: policy.type, id: policy.id, ...fromSmPermission(DefaultPermission) });
    }
    return { policies };
  }

  static create(serviceContainer: ServiceContainer) {
    return new AccessSetCommand(SmAccessPolicyStore.create(serviceContainer));
  }
}
