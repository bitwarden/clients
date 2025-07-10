import { AccountStatusResponse } from "./account-status-response";
import { CannotDecryptErrorResponse } from "./cannot-decrypt-error-response";
import { CipherResponse } from "./cipher-response";
import { FailureStatusResponse } from "./failure-status-response";
import { GenerateResponse } from "./generate-response";
import { SuccessStatusResponse } from "./success-status-response";
import { UserStatusErrorResponse } from "./user-status-error-response";

export type MessageResponseData =
  | AccountStatusResponse[]
  | CannotDecryptErrorResponse
  | CipherResponse[]
  | FailureStatusResponse
  | GenerateResponse
  | SuccessStatusResponse
  | UserStatusErrorResponse;
