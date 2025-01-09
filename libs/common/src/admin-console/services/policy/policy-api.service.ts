import { firstValueFrom } from "rxjs";

import { ApiService } from "../../../abstractions/api.service";
import { HttpStatusCode } from "../../../enums";
import { ErrorResponse } from "../../../models/response/error.response";
import { ListResponse } from "../../../models/response/list.response";
import { Utils } from "../../../platform/misc/utils";
import { PolicyApiServiceAbstraction } from "../../abstractions/policy/policy-api.service.abstraction";
import { InternalPolicyService } from "../../abstractions/policy/policy.service.abstraction";
import { PolicyType } from "../../enums";
import { PolicyData } from "../../models/data/policy.data";
import { MasterPasswordPolicyOptions } from "../../models/domain/master-password-policy-options";
import { Policy } from "../../models/domain/policy";
import { PolicyRequest } from "../../models/request/policy.request";
import { PolicyResponse } from "../../models/response/policy.response";

export class PolicyApiService implements PolicyApiServiceAbstraction {
  constructor(
    private policyService: InternalPolicyService,
    private apiService: ApiService,
  ) {}

  async getPolicy(organizationId: string, type: PolicyType): Promise<PolicyResponse> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/policies/" + type,
      null,
      true,
      true,
    );
    return new PolicyResponse(r);
  }

  async getPolicies(organizationId: string): Promise<ListResponse<PolicyResponse>> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/policies",
      null,
      true,
      true,
    );
    return new ListResponse(r, PolicyResponse);
  }

  async getPoliciesByToken(
    organizationId: string,
    token: string,
    email: string,
    organizationUserId: string,
  ): Promise<Policy[] | undefined> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" +
        organizationId +
        "/policies/token?" +
        "token=" +
        encodeURIComponent(token) +
        "&email=" +
        Utils.encodeRFC3986URIComponent(email) +
        "&organizationUserId=" +
        organizationUserId,
      null,
      false,
      true,
    );
    return Policy.fromListResponse(new ListResponse(r, PolicyResponse));
  }

  private async getMasterPasswordPolicyResponseForOrgUser(
    organizationId: string,
  ): Promise<PolicyResponse> {
    const response = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/policies/master-password",
      null,
      true,
      true,
    );

    return new PolicyResponse(response);
  }

  async getMasterPasswordPolicyOptsForOrgUser(
    orgId: string,
  ): Promise<MasterPasswordPolicyOptions | null> {
    try {
      const masterPasswordPolicyResponse =
        await this.getMasterPasswordPolicyResponseForOrgUser(orgId);

      const masterPasswordPolicy = Policy.fromResponse(masterPasswordPolicyResponse);

      if (!masterPasswordPolicy) {
        return null;
      }

      return await firstValueFrom(
        this.policyService.masterPasswordPolicyOptions$([masterPasswordPolicy]),
      );
    } catch (error) {
      // If policy not found, return null
      if (error instanceof ErrorResponse && error.statusCode === HttpStatusCode.NotFound) {
        return null;
      }
      // otherwise rethrow error
      throw error;
    }
  }

  async putPolicy(organizationId: string, type: PolicyType, request: PolicyRequest): Promise<any> {
    const r = await this.apiService.send(
      "PUT",
      "/organizations/" + organizationId + "/policies/" + type,
      request,
      true,
      true,
    );
    const response = new PolicyResponse(r);
    const data = new PolicyData(response);
    await this.policyService.upsert(data);
  }
}
