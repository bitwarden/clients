import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { ServiceContainer } from "../../service-container";
import { SmAccessPolicyResponse } from "../models/sm-access-policy.response";

import {
  checkSmAccessPolicy,
  fromSmPermission,
  parseSmPermission,
  SmAccessPolicyStore,
} from "./sm-access-policies";

/**
 * Grants a single grantee access, or changes its permission, while keeping every other
 * existing policy on the target.
 */
export class AccessGrantCommand {
  constructor(private store: SmAccessPolicyStore) {}

  async run(
    organizationId: string,
    target: string,
    targetId: string,
    grantee: string,
    permission: string,
  ): Promise<Response> {
    const parsedPermission = parseSmPermission(permission);
    if (parsedPermission.error) {
      return parsedPermission.error;
    }
    const loaded = await this.store.load(organizationId, target, targetId);
    if (loaded.error) {
      return loaded.error;
    }
    const state = loaded.state;
    const resolved = await this.store.resolveGrantee(state, grantee);
    if (resolved.error) {
      return resolved.error;
    }
    const invalid = checkSmAccessPolicy(
      state.target,
      resolved.grantee.type,
      parsedPermission.permission,
    );
    if (invalid) {
      return invalid;
    }

    const isTarget = (p: { type: string; id: string }) =>
      p.type === resolved.grantee.type && p.id.toLowerCase() === resolved.grantee.id.toLowerCase();
    const policies = [
      ...state.policies.filter((p) => !isTarget(p)),
      {
        type: resolved.grantee.type,
        id: resolved.grantee.id,
        name: resolved.grantee.name,
        ...fromSmPermission(parsedPermission.permission),
      },
    ];

    const saved = await this.store.save(state, policies);
    if (saved.error) {
      return saved.error;
    }
    return Response.success(
      new ListResponse(saved.policies.map((p) => new SmAccessPolicyResponse(p))),
    );
  }

  static create(serviceContainer: ServiceContainer) {
    return new AccessGrantCommand(SmAccessPolicyStore.create(serviceContainer));
  }
}
