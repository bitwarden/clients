import { AuthRequest } from "@bitwarden/common/auth/models/request/auth.request";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";

export abstract class AuthRequestApiServiceAbstraction {
  /**
   * Gets a list of pending auth requests based on the user. There will only be one AuthRequest per device and the
   * AuthRequest will be the most recent pending request.
   *
   * @returns A promise that resolves to a list response containing auth request responses.
   */
  abstract getPendingAuthRequests(): Promise<ListResponse<AuthRequestResponse>>;

  /**
   * Gets an auth request by its ID.
   *
   * @param requestId The ID of the auth request.
   * @returns A promise that resolves to the auth request response.
   */
  abstract getAuthRequest: (requestId: string) => Promise<AuthRequestResponse>;

  /**
   * Gets an auth request response by its ID and access code.
   *
   * @param requestId The ID of the auth request.
   * @param accessCode The access code of the auth request.
   * @returns A promise that resolves to the auth request response.
   */
  abstract getAuthResponse: (requestId: string, accessCode: string) => Promise<AuthRequestResponse>;

  /**
   * Sends an admin auth request.
   *
   * @param request The auth request object.
   * @returns A promise that resolves to the auth request response.
   */
  abstract postAdminAuthRequest: (request: AuthRequest) => Promise<AuthRequestResponse>;

  /**
   * Sends an auth request.
   *
   * @param request The auth request object.
   * @returns A promise that resolves to the auth request response.
   */
  abstract postAuthRequest: (request: AuthRequest) => Promise<AuthRequestResponse>;
}
