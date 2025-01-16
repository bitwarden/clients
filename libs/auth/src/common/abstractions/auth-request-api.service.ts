import { AuthRequest } from "@bitwarden/common/auth/models/request/auth.request";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";

export abstract class AuthRequestApiService {
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
