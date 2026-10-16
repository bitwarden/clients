import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { ServiceContainer } from "../../service-container";
import { SmAccessPolicyResponse } from "../models/sm-access-policy.response";

import { SmAccessPolicyStore } from "./sm-access-policies";

export class AccessGetCommand {
  constructor(private store: SmAccessPolicyStore) {}

  async run(organizationId: string, target: string, targetId: string): Promise<Response> {
    const loaded = await this.store.load(organizationId, target, targetId);
    if (loaded.error) {
      return loaded.error;
    }
    return Response.success(
      new ListResponse(loaded.state.policies.map((p) => new SmAccessPolicyResponse(p))),
    );
  }

  static create(serviceContainer: ServiceContainer) {
    return new AccessGetCommand(SmAccessPolicyStore.create(serviceContainer));
  }
}
