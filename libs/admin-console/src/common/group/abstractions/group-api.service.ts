import { ListResponse } from "@bitwarden/common/models/response/list.response";

import { GroupDetailsResponse, GroupResponse } from "../models/responses";

/**
 * Service for interacting with Organization Groups via the API
 */
export abstract class GroupApiService {
  /**
   * Retrieve all groups that belong to the specified organization
   * @param organizationId - Identifier for the organization
   */
  abstract getAll(organizationId: string): Promise<ListResponse<GroupResponse>>;

  /**
   * Retrieve all groups with collection details for the specified organization
   * @param organizationId - Identifier for the organization
   */
  abstract getAllDetails(organizationId: string): Promise<ListResponse<GroupDetailsResponse>>;

  /**
   * Retrieve a single group by Id
   * @param organizationId - Identifier for the group's organization
   * @param groupId - Group identifier
   */
  abstract get(organizationId: string, groupId: string): Promise<GroupDetailsResponse>;

  /**
   * Retrieve all user IDs that belong to the specified group
   * @param organizationId - Identifier for the group's organization
   * @param groupId - Group identifier
   */
  abstract getUsers(organizationId: string, groupId: string): Promise<string[]>;
}
