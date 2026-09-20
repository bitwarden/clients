import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { UserId } from "@bitwarden/common/types/guid";

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

  async getEmergencyAccessTrusted(
    userId: UserId,
  ): Promise<ListResponse<EmergencyAccessGranteeDetailsResponse>> {
    const r = await this.apiService.send("GET", "/emergency-access/trusted", null, userId, true);
    return new ListResponse(r, EmergencyAccessGranteeDetailsResponse);
  }

  async getEmergencyAccessGranted(
    userId: UserId,
  ): Promise<ListResponse<EmergencyAccessGrantorDetailsResponse>> {
    const r = await this.apiService.send("GET", "/emergency-access/granted", null, userId, true);
    return new ListResponse(r, EmergencyAccessGrantorDetailsResponse);
  }

  async getEmergencyAccess(
    id: string,
    userId: UserId,
  ): Promise<EmergencyAccessGranteeDetailsResponse> {
    const r = await this.apiService.send("GET", "/emergency-access/" + id, null, userId, true);
    return new EmergencyAccessGranteeDetailsResponse(r);
  }

  async getEmergencyGrantorPolicies(
    id: string,
    userId: UserId,
  ): Promise<ListResponse<PolicyResponse>> {
    const r = await this.apiService.send(
      "GET",
      "/emergency-access/" + id + "/policies",
      null,
      userId,
      true,
    );
    return new ListResponse(r, PolicyResponse);
  }

  putEmergencyAccess(
    id: string,
    request: EmergencyAccessUpdateRequest,
    userId: UserId,
  ): Promise<void> {
    return this.apiService.send("PUT", "/emergency-access/" + id, request, userId, false);
  }

  deleteEmergencyAccess(id: string, userId: UserId): Promise<void> {
    return this.apiService.send("DELETE", "/emergency-access/" + id, null, userId, false);
  }

  postEmergencyAccessInvite(request: EmergencyAccessInviteRequest, userId: UserId): Promise<void> {
    return this.apiService.send("POST", "/emergency-access/invite", request, userId, false);
  }

  postEmergencyAccessReinvite(id: string, userId: UserId): Promise<void> {
    return this.apiService.send(
      "POST",
      "/emergency-access/" + id + "/reinvite",
      null,
      userId,
      false,
    );
  }

  postEmergencyAccessAccept(
    id: string,
    request: EmergencyAccessAcceptRequest,
    userId: UserId,
  ): Promise<void> {
    return this.apiService.send(
      "POST",
      "/emergency-access/" + id + "/accept",
      request,
      userId,
      false,
    );
  }

  postEmergencyAccessConfirm(
    id: string,
    request: EmergencyAccessConfirmRequest,
    userId: UserId,
  ): Promise<void> {
    return this.apiService.send(
      "POST",
      "/emergency-access/" + id + "/confirm",
      request,
      userId,
      false,
    );
  }

  postEmergencyAccessInitiate(id: string, userId: UserId): Promise<void> {
    return this.apiService.send(
      "POST",
      "/emergency-access/" + id + "/initiate",
      null,
      userId,
      false,
    );
  }

  postEmergencyAccessApprove(id: string, userId: UserId): Promise<void> {
    return this.apiService.send(
      "POST",
      "/emergency-access/" + id + "/approve",
      null,
      userId,
      false,
    );
  }

  postEmergencyAccessReject(id: string, userId: UserId): Promise<void> {
    return this.apiService.send(
      "POST",
      "/emergency-access/" + id + "/reject",
      null,
      userId,
      false,
    );
  }

  async postEmergencyAccessTakeover(
    id: string,
    userId: UserId,
  ): Promise<EmergencyAccessTakeoverResponse> {
    const r = await this.apiService.send(
      "POST",
      "/emergency-access/" + id + "/takeover",
      null,
      userId,
      true,
    );
    return new EmergencyAccessTakeoverResponse(r);
  }

  async postEmergencyAccessPassword(
    id: string,
    request: EmergencyAccessPasswordRequest,
    userId: UserId,
  ): Promise<void> {
    await this.apiService.send(
      "POST",
      "/emergency-access/" + id + "/password",
      request,
      userId,
      true,
    );
  }

  async postEmergencyAccessView(
    id: string,
    userId: UserId,
  ): Promise<EmergencyAccessViewResponse> {
    const r = await this.apiService.send(
      "POST",
      "/emergency-access/" + id + "/view",
      null,
      userId,
      true,
    );
    return new EmergencyAccessViewResponse(r);
  }
}
