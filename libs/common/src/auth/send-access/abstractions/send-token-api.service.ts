import { SendAccessTokenRequest } from "../../models/request/identity-token/send-access-token.request";
import { SendAccessToken } from "../models/send-access-token";
import { SendTokenApiError } from "../services/send-token-api.service";

/**
 * Abstract class for the SendTokenApiService.
 * Communicates with Identity to obtain send access tokens.
 */
export abstract class SendTokenApiService {
  /**
   * Requests a send access token from Identity server.
   * @param request The request object containing the necessary parameters to obtain the access token.
   * @returns A promise that resolves to a SendAccessToken or a SendTokenApiError.
   */
  abstract requestSendAccessToken: (
    request: SendAccessTokenRequest,
  ) => Promise<SendAccessToken | SendTokenApiError>;
}
