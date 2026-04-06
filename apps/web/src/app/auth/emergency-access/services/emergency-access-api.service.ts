import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";

import { EmergencyAccessAcceptRequest } from "../request/emergency-access-accept.request";
import { EmergencyAccessConfirmRequest } from "../request/emergency-access-confirm.request";
import { EmergencyAccessInviteRequest } from "../request/emergency-access-invite.request";
import { EmergencyAccessPasswordRequest } from "../request/emergency-access-password.request";
import { EmergencyAccessUpdateRequest } from "../request/emergency-access-update.request";
import {
  EmergencyAccessGranteeDetailsResponse,
  EmergencyAccessGrantorDetailsResponse,
  EmergencyAccessTakeoverResponse,
  EmergencyAccessViewResponse,
} from "../response/emergency-access.response";

@Injectable()
export class EmergencyAccessApiService {
  constructor(private apiService: ApiService) {}

  async getEmergencyAccessTrusted(): Promise<ListResponse<EmergencyAccessGranteeDetailsResponse>> {
    const r = await this.apiService.send("GET", "/emergency-access/trusted", null, true, true);
    return new ListResponse(r, EmergencyAccessGranteeDetailsResponse);
  }

  async getEmergencyAccessGranted(): Promise<ListResponse<EmergencyAccessGrantorDetailsResponse>> {
    const r = await this.apiService.send("GET", "/emergency-access/granted", null, true, true);
    return new ListResponse(r, EmergencyAccessGrantorDetailsResponse);
  }

  async getEmergencyAccess(id: string): Promise<EmergencyAccessGranteeDetailsResponse> {
    const r = await this.apiService.send("GET", "/emergency-access/" + id, null, true, true);
    return new EmergencyAccessGranteeDetailsResponse(r);
  }

  async getEmergencyGrantorPolicies(id: string): Promise<ListResponse<PolicyResponse>> {
    const r = await this.apiService.send(
      "GET",
      "/emergency-access/" + id + "/policies",
      null,
      true,
      true,
    );
    return new ListResponse(r, PolicyResponse);
  }

  putEmergencyAccess(id: string, request: EmergencyAccessUpdateRequest): Promise<void> {
    return this.apiService.send("PUT", "/emergency-access/" + id, request, true, false);
  }

  deleteEmergencyAccess(id: string): Promise<void> {
    return this.apiService.send("DELETE", "/emergency-access/" + id, null, true, false);
  }

  postEmergencyAccessInvite(request: EmergencyAccessInviteRequest): Promise<void> {
    return this.apiService.send("POST", "/emergency-access/invite", request, true, false);
  }

  postEmergencyAccessReinvite(id: string): Promise<void> {
    return this.apiService.send("POST", "/emergency-access/" + id + "/reinvite", null, true, false);
  }

  postEmergencyAccessAccept(id: string, request: EmergencyAccessAcceptRequest): Promise<void> {
    return this.apiService.send(
      "POST",
      "/emergency-access/" + id + "/accept",
      request,
      true,
      false,
    );
  }

  postEmergencyAccessConfirm(id: string, request: EmergencyAccessConfirmRequest): Promise<void> {
    return this.apiService.send(
      "POST",
      "/emergency-access/" + id + "/confirm",
      request,
      true,
      false,
    );
  }

  postEmergencyAccessInitiate(id: string): Promise<void> {
    return this.apiService.send("POST", "/emergency-access/" + id + "/initiate", null, true, false);
  }

  postEmergencyAccessApprove(id: string): Promise<void> {
    return this.apiService.send("POST", "/emergency-access/" + id + "/approve", null, true, false);
  }

  postEmergencyAccessReject(id: string): Promise<void> {
    return this.apiService.send("POST", "/emergency-access/" + id + "/reject", null, true, false);
  }

  async postEmergencyAccessTakeover(id: string): Promise<EmergencyAccessTakeoverResponse> {
    const r = await this.apiService.send(
      "POST",
      "/emergency-access/" + id + "/takeover",
      null,
      true,
      true,
    );
    return new EmergencyAccessTakeoverResponse(r);
  }

  async postEmergencyAccessPassword(
    id: string,
    request: EmergencyAccessPasswordRequest,
  ): Promise<void> {
    await this.apiService.send(
      "POST",
      "/emergency-access/" + id + "/password",
      request,
      true,
      true,
    );
  }

  async postEmergencyAccessView(id: string): Promise<EmergencyAccessViewResponse> {
    const r = await this.apiService.send(
      "POST",
      "/emergency-access/" + id + "/view",
      null,
      true,
      true,
    );
    return new EmergencyAccessViewResponse(r);
  }
}
