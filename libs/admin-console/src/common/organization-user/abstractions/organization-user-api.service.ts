import { ListResponse } from "@bitwarden/common/models/response/list.response";

import {
  OrganizationUserAcceptInitRequest,
  OrganizationUserAcceptRequest,
  OrganizationUserBulkConfirmRequest,
  OrganizationUserConfirmRequest,
  OrganizationUserInviteRequest,
  OrganizationUserResetPasswordEnrollmentRequest,
  OrganizationUserResetPasswordRequest,
  OrganizationUserUpdateRequest,
} from "../models/requests";
import {
  OrganizationUserBulkPublicKeyResponse,
  OrganizationUserBulkResponse,
  OrganizationUserDetailsResponse,
  OrganizationUserResetPasswordDetailsResponse,
  OrganizationUserUserDetailsResponse,
  OrganizationUserUserMiniResponse,
} from "../models/responses";

/**
 * Service for interacting with Organization Users via the API
 */
export abstract class OrganizationUserApiService {
  /**
   * Retrieve a single organization user by Id
   * @param organizationId - Identifier for the user's organization
   * @param id - Organization user identifier
   * @param options - Options for the request
   */
  abstract getOrganizationUser(
    organizationId: string,
    id: string,
    options?: {
      includeGroups?: boolean;
    },
  ): Promise<OrganizationUserDetailsResponse>;

  /**
   * Retrieve full details of all users that belong to the specified organization.
   * This is only accessible to privileged users, if you need a simple listing of basic details, use
   * {@link getAllMiniUserDetails}.
   * @param organizationId - Identifier for the organization
   * @param options - Options for the request
   */
  abstract getAllUsers(
    organizationId: string,
    options?: {
      includeCollections?: boolean;
      includeGroups?: boolean;
    },
  ): Promise<ListResponse<OrganizationUserUserDetailsResponse>>;

  /**
   * Retrieve a list of all users that belong to the specified organization, with basic information only.
   * This is suitable for lists of names/emails etc. throughout the app and can be accessed by most users.
   * @param organizationId - Identifier for the organization
   * @param options - Options for the request
   */
  abstract getAllMiniUserDetails(
    organizationId: string,
  ): Promise<ListResponse<OrganizationUserUserMiniResponse>>;

  /**
   * Retrieve reset password details for the specified organization user
   * @param organizationId - Identifier for the user's organization
   * @param id - Organization user identifier
   */
  abstract getOrganizationUserResetPasswordDetails(
    organizationId: string,
    id: string,
  ): Promise<OrganizationUserResetPasswordDetailsResponse>;

  /**
   * Retrieve reset password details for many organization users
   * @param organizationId - Identifier for the organization
   * @param ids - A list of organization user identifiers
   */
  abstract getManyOrganizationUserAccountRecoveryDetails(
    organizationId: string,
    ids: string[],
  ): Promise<ListResponse<OrganizationUserResetPasswordDetailsResponse>>;

  /**
   * Create new organization user invite(s) for the specified organization
   * @param organizationId - Identifier for the organization
   * @param request - New user invitation request details
   */
  abstract postOrganizationUserInvite(
    organizationId: string,
    request: OrganizationUserInviteRequest,
  ): Promise<void>;

  /**
   * Re-invite the specified organization user
   * @param organizationId - Identifier for the user's organization
   * @param id - Organization user identifier
   */
  abstract postOrganizationUserReinvite(organizationId: string, id: string): Promise<any>;

  /**
   * Re-invite many organization users for the specified organization
   * @param organizationId - Identifier for the organization
   * @param ids - A list of organization user identifiers
   * @return List of user ids, including both those that were successfully re-invited and those that had an error
   */
  abstract postManyOrganizationUserReinvite(
    organizationId: string,
    ids: string[],
  ): Promise<ListResponse<OrganizationUserBulkResponse>>;

  /**
   * Accept an invitation to initialize and join an organization created via the Admin Portal **only**.
   * This is only used once for the initial Owner, because it also creates the organization's encryption keys.
   * This should not be used for organizations created via the Web client.
   * @param organizationId - Identifier for the organization to accept
   * @param id - Organization user identifier
   * @param request - Request details for accepting the invitation
   */
  abstract postOrganizationUserAcceptInit(
    organizationId: string,
    id: string,
    request: OrganizationUserAcceptInitRequest,
  ): Promise<void>;

  /**
   * Accept an organization user invitation
   * @param organizationId - Identifier for the organization to accept
   * @param id - Organization user identifier
   * @param request - Request details for accepting the invitation
   */
  abstract postOrganizationUserAccept(
    organizationId: string,
    id: string,
    request: OrganizationUserAcceptRequest,
  ): Promise<void>;

  /**
   * Confirm an organization user that has accepted their invitation
   * @param organizationId - Identifier for the organization to confirm
   * @param id - Organization user identifier
   * @param request - Request details for confirming the user
   */
  abstract postOrganizationUserConfirm(
    organizationId: string,
    id: string,
    request: OrganizationUserConfirmRequest,
  ): Promise<void>;

  /**
   * Retrieve a list of the specified users' public keys
   * @param organizationId - Identifier for the organization to accept
   * @param ids - A list of organization user identifiers to retrieve public keys for
   */
  abstract postOrganizationUsersPublicKey(
    organizationId: string,
    ids: string[],
  ): Promise<ListResponse<OrganizationUserBulkPublicKeyResponse>>;

  /**
   * Confirm many organization users that have accepted their invitations
   * @param organizationId - Identifier for the organization to confirm users
   * @param request - Bulk request details for confirming the user
   */
  abstract postOrganizationUserBulkConfirm(
    organizationId: string,
    request: OrganizationUserBulkConfirmRequest,
  ): Promise<ListResponse<OrganizationUserBulkResponse>>;

  /**
   * Update an organization users
   * @param organizationId - Identifier for the organization the user belongs to
   * @param id - Organization user identifier
   * @param request - Request details for updating the user
   */
  abstract putOrganizationUser(
    organizationId: string,
    id: string,
    request: OrganizationUserUpdateRequest,
  ): Promise<void>;

  /**
   * Update an organization user's reset password enrollment
   * @param organizationId - Identifier for the organization the user belongs to
   * @param userId - Organization user identifier
   * @param request - Reset password enrollment details
   */
  abstract putOrganizationUserResetPasswordEnrollment(
    organizationId: string,
    userId: string,
    request: OrganizationUserResetPasswordEnrollmentRequest,
  ): Promise<void>;

  /**
   * Reset an organization user's password
   * @param organizationId - Identifier for the organization the user belongs to
   * @param id - Organization user identifier
   * @param request - Reset password details
   */
  abstract putOrganizationUserResetPassword(
    organizationId: string,
    id: string,
    request: OrganizationUserResetPasswordRequest,
  ): Promise<void>;

  /**
   * Enable Secrets Manager for many users
   * @param organizationId - Identifier for the organization the user belongs to
   * @param ids - List of organization user identifiers to enable
   * @return List of user ids, including both those that were successfully enabled and those that had an error
   */
  abstract putOrganizationUserBulkEnableSecretsManager(
    organizationId: string,
    ids: string[],
  ): Promise<void>;

  /**
   * Remove an organization user
   * @param organizationId - Identifier for the organization the user belongs to
   * @param id - Organization user identifier
   */
  abstract removeOrganizationUser(organizationId: string, id: string): Promise<void>;

  /**
   * Remove many organization users
   * @param organizationId - Identifier for the organization the users belongs to
   * @param ids - List of organization user identifiers to remove
   * @return List of user ids, including both those that were successfully removed and those that had an error
   */
  abstract removeManyOrganizationUsers(
    organizationId: string,
    ids: string[],
  ): Promise<ListResponse<OrganizationUserBulkResponse>>;

  /**
   * Revoke an organization user's access to the organization
   * @param organizationId - Identifier for the organization the user belongs to
   * @param id - Organization user identifier
   */
  abstract revokeOrganizationUser(organizationId: string, id: string): Promise<void>;

  /**
   * Revoke many organization users' access to the organization
   * @param organizationId - Identifier for the organization the users belongs to
   * @param ids - List of organization user identifiers to revoke
   * @return List of user ids, including both those that were successfully revoked and those that had an error
   */
  abstract revokeManyOrganizationUsers(
    organizationId: string,
    ids: string[],
  ): Promise<ListResponse<OrganizationUserBulkResponse>>;

  /**
   * Restore an organization user's access to the organization
   * @param organizationId - Identifier for the organization the user belongs to
   * @param id - Organization user identifier
   */
  abstract restoreOrganizationUser(organizationId: string, id: string): Promise<void>;

  /**
   * Restore many organization users' access to the organization
   * @param organizationId - Identifier for the organization the users belongs to
   * @param ids - List of organization user identifiers to restore
   * @return List of user ids, including both those that were successfully restored and those that had an error
   */
  abstract restoreManyOrganizationUsers(
    organizationId: string,
    ids: string[],
  ): Promise<ListResponse<OrganizationUserBulkResponse>>;

  /**
   * Remove an organization user's access to the organization and delete their account data
   * @param organizationId - Identifier for the organization the user belongs to
   * @param id - Organization user identifier
   */
  abstract deleteOrganizationUser(organizationId: string, id: string): Promise<void>;

  /**
   * Delete many organization users
   * @param organizationId - Identifier for the organization the users belongs to
   * @param ids - List of organization user identifiers to delete
   * @return List of user ids, including both those that were successfully deleted and those that had an error
   */
  abstract deleteManyOrganizationUsers(
    organizationId: string,
    ids: string[],
  ): Promise<ListResponse<OrganizationUserBulkResponse>>;
}
