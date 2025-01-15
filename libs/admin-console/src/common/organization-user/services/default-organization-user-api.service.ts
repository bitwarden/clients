import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";

import { OrganizationUserApiService } from "../abstractions";
import {
  OrganizationUserAcceptInitRequest,
  OrganizationUserAcceptRequest,
  OrganizationUserBulkConfirmRequest,
  OrganizationUserConfirmRequest,
  OrganizationUserInviteRequest,
  OrganizationUserResetPasswordEnrollmentRequest,
  OrganizationUserResetPasswordRequest,
  OrganizationUserUpdateRequest,
  OrganizationUserBulkRequest,
} from "../models/requests";
import {
  OrganizationUserBulkPublicKeyResponse,
  OrganizationUserBulkResponse,
  OrganizationUserDetailsResponse,
  OrganizationUserResetPasswordDetailsResponse,
  OrganizationUserUserDetailsResponse,
  OrganizationUserUserMiniResponse,
} from "../models/responses";

export class DefaultOrganizationUserApiService implements OrganizationUserApiService {
  constructor(private apiService: ApiService) {}

  async getOrganizationUser(
    organizationId: string,
    id: string,
    options?: {
      includeGroups?: boolean;
    },
  ): Promise<OrganizationUserDetailsResponse> {
    const params = new URLSearchParams();

    if (options?.includeGroups) {
      params.set("includeGroups", "true");
    }

    const r = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/users/${id}?${params.toString()}`,
      null,
      true,
      true,
    );
    return new OrganizationUserDetailsResponse(r);
  }

  async getOrganizationUserGroups(organizationId: string, id: string): Promise<string[]> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/users/" + id + "/groups",
      null,
      true,
      true,
    );
    return r;
  }

  async getAllUsers(
    organizationId: string,
    options?: {
      includeCollections?: boolean;
      includeGroups?: boolean;
    },
  ): Promise<ListResponse<OrganizationUserUserDetailsResponse>> {
    const params = new URLSearchParams();

    if (options?.includeCollections) {
      params.set("includeCollections", "true");
    }
    if (options?.includeGroups) {
      params.set("includeGroups", "true");
    }

    const r = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/users?${params.toString()}`,
      null,
      true,
      true,
    );
    return new ListResponse(r, OrganizationUserUserDetailsResponse);
  }

  async getAllMiniUserDetails(
    organizationId: string,
  ): Promise<ListResponse<OrganizationUserUserMiniResponse>> {
    const r = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/users/mini-details`,
      null,
      true,
      true,
    );
    return new ListResponse(r, OrganizationUserUserMiniResponse);
  }

  async getOrganizationUserResetPasswordDetails(
    organizationId: string,
    id: string,
  ): Promise<OrganizationUserResetPasswordDetailsResponse> {
    const r = await this.apiService.send(
      "GET",
      "/organizations/" + organizationId + "/users/" + id + "/reset-password-details",
      null,
      true,
      true,
    );
    return new OrganizationUserResetPasswordDetailsResponse(r);
  }

  async getManyOrganizationUserAccountRecoveryDetails(
    organizationId: string,
    ids: string[],
  ): Promise<ListResponse<OrganizationUserResetPasswordDetailsResponse>> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/" + organizationId + "/users/account-recovery-details",
      new OrganizationUserBulkRequest(ids),
      true,
      true,
    );
    return new ListResponse(r, OrganizationUserResetPasswordDetailsResponse);
  }

  postOrganizationUserInvite(
    organizationId: string,
    request: OrganizationUserInviteRequest,
  ): Promise<void> {
    return this.apiService.send(
      "POST",
      "/organizations/" + organizationId + "/users/invite",
      request,
      true,
      false,
    );
  }

  postOrganizationUserReinvite(organizationId: string, id: string): Promise<any> {
    return this.apiService.send(
      "POST",
      "/organizations/" + organizationId + "/users/" + id + "/reinvite",
      null,
      true,
      false,
    );
  }

  async postManyOrganizationUserReinvite(
    organizationId: string,
    ids: string[],
  ): Promise<ListResponse<OrganizationUserBulkResponse>> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/" + organizationId + "/users/reinvite",
      new OrganizationUserBulkRequest(ids),
      true,
      true,
    );
    return new ListResponse(r, OrganizationUserBulkResponse);
  }

  postOrganizationUserAcceptInit(
    organizationId: string,
    id: string,
    request: OrganizationUserAcceptInitRequest,
  ): Promise<void> {
    return this.apiService.send(
      "POST",
      "/organizations/" + organizationId + "/users/" + id + "/accept-init",
      request,
      true,
      false,
    );
  }

  postOrganizationUserAccept(
    organizationId: string,
    id: string,
    request: OrganizationUserAcceptRequest,
  ): Promise<void> {
    return this.apiService.send(
      "POST",
      "/organizations/" + organizationId + "/users/" + id + "/accept",
      request,
      true,
      false,
    );
  }

  postOrganizationUserConfirm(
    organizationId: string,
    id: string,
    request: OrganizationUserConfirmRequest,
  ): Promise<void> {
    return this.apiService.send(
      "POST",
      "/organizations/" + organizationId + "/users/" + id + "/confirm",
      request,
      true,
      false,
    );
  }

  async postOrganizationUsersPublicKey(
    organizationId: string,
    ids: string[],
  ): Promise<ListResponse<OrganizationUserBulkPublicKeyResponse>> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/" + organizationId + "/users/public-keys",
      new OrganizationUserBulkRequest(ids),
      true,
      true,
    );
    return new ListResponse(r, OrganizationUserBulkPublicKeyResponse);
  }

  async postOrganizationUserBulkConfirm(
    organizationId: string,
    request: OrganizationUserBulkConfirmRequest,
  ): Promise<ListResponse<OrganizationUserBulkResponse>> {
    const r = await this.apiService.send(
      "POST",
      "/organizations/" + organizationId + "/users/confirm",
      request,
      true,
      true,
    );
    return new ListResponse(r, OrganizationUserBulkResponse);
  }

  async putOrganizationUserBulkEnableSecretsManager(
    organizationId: string,
    ids: string[],
  ): Promise<void> {
    await this.apiService.send(
      "PUT",
      "/organizations/" + organizationId + "/users/enable-secrets-manager",
      new OrganizationUserBulkRequest(ids),
      true,
      false,
    );
  }

  putOrganizationUser(
    organizationId: string,
    id: string,
    request: OrganizationUserUpdateRequest,
  ): Promise<void> {
    return this.apiService.send(
      "PUT",
      "/organizations/" + organizationId + "/users/" + id,
      request,
      true,
      false,
    );
  }

  putOrganizationUserResetPasswordEnrollment(
    organizationId: string,
    userId: string,
    request: OrganizationUserResetPasswordEnrollmentRequest,
  ): Promise<void> {
    return this.apiService.send(
      "PUT",
      "/organizations/" + organizationId + "/users/" + userId + "/reset-password-enrollment",
      request,
      true,
      false,
    );
  }

  putOrganizationUserResetPassword(
    organizationId: string,
    id: string,
    request: OrganizationUserResetPasswordRequest,
  ): Promise<void> {
    return this.apiService.send(
      "PUT",
      "/organizations/" + organizationId + "/users/" + id + "/reset-password",
      request,
      true,
      false,
    );
  }

  removeOrganizationUser(organizationId: string, id: string): Promise<any> {
    return this.apiService.send(
      "DELETE",
      "/organizations/" + organizationId + "/users/" + id,
      null,
      true,
      false,
    );
  }

  async removeManyOrganizationUsers(
    organizationId: string,
    ids: string[],
  ): Promise<ListResponse<OrganizationUserBulkResponse>> {
    const r = await this.apiService.send(
      "DELETE",
      "/organizations/" + organizationId + "/users",
      new OrganizationUserBulkRequest(ids),
      true,
      true,
    );
    return new ListResponse(r, OrganizationUserBulkResponse);
  }

  revokeOrganizationUser(organizationId: string, id: string): Promise<void> {
    return this.apiService.send(
      "PUT",
      "/organizations/" + organizationId + "/users/" + id + "/revoke",
      null,
      true,
      false,
    );
  }

  async revokeManyOrganizationUsers(
    organizationId: string,
    ids: string[],
  ): Promise<ListResponse<OrganizationUserBulkResponse>> {
    const r = await this.apiService.send(
      "PUT",
      "/organizations/" + organizationId + "/users/revoke",
      new OrganizationUserBulkRequest(ids),
      true,
      true,
    );
    return new ListResponse(r, OrganizationUserBulkResponse);
  }

  restoreOrganizationUser(organizationId: string, id: string): Promise<void> {
    return this.apiService.send(
      "PUT",
      "/organizations/" + organizationId + "/users/" + id + "/restore",
      null,
      true,
      false,
    );
  }

  async restoreManyOrganizationUsers(
    organizationId: string,
    ids: string[],
  ): Promise<ListResponse<OrganizationUserBulkResponse>> {
    const r = await this.apiService.send(
      "PUT",
      "/organizations/" + organizationId + "/users/restore",
      new OrganizationUserBulkRequest(ids),
      true,
      true,
    );
    return new ListResponse(r, OrganizationUserBulkResponse);
  }

  deleteOrganizationUser(organizationId: string, id: string): Promise<void> {
    return this.apiService.send(
      "DELETE",
      "/organizations/" + organizationId + "/users/" + id + "/delete-account",
      null,
      true,
      false,
    );
  }

  async deleteManyOrganizationUsers(
    organizationId: string,
    ids: string[],
  ): Promise<ListResponse<OrganizationUserBulkResponse>> {
    const r = await this.apiService.send(
      "DELETE",
      "/organizations/" + organizationId + "/users/delete-account",
      new OrganizationUserBulkRequest(ids),
      true,
      true,
    );
    return new ListResponse(r, OrganizationUserBulkResponse);
  }
}
