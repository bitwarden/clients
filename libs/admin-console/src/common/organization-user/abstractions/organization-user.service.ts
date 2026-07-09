import { Observable } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ListResponse } from "@bitwarden/common/models/response/list.response";

import { OrganizationUserConfirmRequest, OrganizationUserBulkResponse } from "../..";
import { OrganizationUserUpdateRequest } from "../models/requests";

export abstract class OrganizationUserService {
  /**
   * Builds a confirmation request for an organization user.
   * @param organization - The organization the user belongs to
   * @param publicKey - The user's public key
   * @returns An observable that emits the confirmation request
   */
  abstract buildConfirmRequest(
    organization: Organization,
    publicKey: Uint8Array,
  ): Observable<OrganizationUserConfirmRequest>;

  /**
   * Confirms a user in an organization.
   * @param organization - The organization the user belongs to
   * @param userId - The ID of the user to confirm
   * @param publicKey - The user's public key
   * @returns An observable that completes when the user is confirmed
   */
  abstract confirmUser(
    organization: Organization,
    userId: string,
    publicKey: Uint8Array,
  ): Observable<void>;

  /**
   * Confirms multiple users in an organization.
   * @param organization - The organization the users belong to
   * @param userIdsWithKeys - Array of user IDs with their encrypted keys
   * @returns An observable that emits the bulk confirmation response
   */
  abstract bulkConfirmUsers(
    organization: Organization,
    userIdsWithKeys: { id: string; key: string }[],
  ): Observable<ListResponse<OrganizationUserBulkResponse>>;

  abstract restoreUser(organization: Organization, userId: string): Observable<void>;

  abstract bulkRestoreUsers(
    organization: Organization,
    userIds: string[],
  ): Observable<ListResponse<OrganizationUserBulkResponse>>;

  /**
   * Updates a user's role and settings in an organization. When the target role is subject to the
   * Centralize Organization Ownership policy (i.e. User or Custom), an encrypted default collection
   * name is included so the server can create the "My Items" collection if it is missing.
   */
  abstract updateUser(
    organization: Organization,
    userId: string,
    request: OrganizationUserUpdateRequest,
  ): Observable<void>;
}
