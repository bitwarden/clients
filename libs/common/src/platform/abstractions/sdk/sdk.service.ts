import { Observable } from "rxjs";

import { BitwardenClient } from "@bitwarden/sdk-internal";

import { UserId } from "../../../types/guid";

export abstract class SdkService {
  /**
   * Check if the SDK is supported in the current environment.
   */
  supported$: Observable<boolean>;

  /**
   * Retrieve a client initialized without a user.
   * This client can only be used for operations that don't require a user context.
   */
  client$: Observable<BitwardenClient | undefined>;

  /**
   * Retrieve a client initialized for a specific user.
   * This client can be used for operations that require a user context, such as retrieving ciphers
   * and operations involving crypto. It can also be used for operations that don't require a user context.
   * @param userId
   */
  abstract userClient$(userId: UserId): Observable<BitwardenClient>;

  abstract failedToInitialize(): Promise<void>;
}
