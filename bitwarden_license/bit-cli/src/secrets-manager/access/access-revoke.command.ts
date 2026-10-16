import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { ServiceContainer } from "../../service-container";
import { SmAccessPolicyResponse } from "../models/sm-access-policy.response";

import { SmAccessPolicyStore } from "./sm-access-policies";

/**
 * Removes a single grantee's access while keeping every other existing policy on the target.
 */
export class AccessRevokeCommand {
  constructor(private store: SmAccessPolicyStore) {}

  async run(
    organizationId: string,
    target: string,
    targetId: string,
    grantee: string,
  ): Promise<Response> {
    const loaded = await this.store.load(organizationId, target, targetId);
    if (loaded.error) {
      return loaded.error;
    }
    const state = loaded.state;
    const resolved = await this.store.resolveGrantee(state, grantee);
    if (resolved.error) {
      return resolved.error;
    }

    const isTarget = (p: { type: string; id: string }) =>
      p.type === resolved.grantee.type && p.id.toLowerCase() === resolved.grantee.id.toLowerCase();
    if (!state.policies.some(isTarget)) {
      return Response.error("`" + grantee + "` does not have access.");
    }

    const saved = await this.store.save(
      state,
      state.policies.filter((p) => !isTarget(p)),
    );
    if (saved.error) {
      return saved.error;
    }
    return Response.success(
      new ListResponse(saved.policies.map((p) => new SmAccessPolicyResponse(p))),
    );
  }

  static create(serviceContainer: ServiceContainer) {
    return new AccessRevokeCommand(SmAccessPolicyStore.create(serviceContainer));
  }
}
