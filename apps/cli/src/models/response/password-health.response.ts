import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherRiskResult } from "@bitwarden/sdk-internal";

import { BaseResponse } from "./base.response";

export class PasswordHealthResponse implements BaseResponse {
  object: string;
  id: string;
  name: string;
  /** Password strength score from 0 (weakest) to 4 (strongest). */
  passwordStrength: number;
  /** Items sharing this password when reused (>= 2), or null if unique or not evaluated. */
  reuseCount: number | null;
  /** Whether the password was found in a known data breach. */
  exposed: boolean;
  /** Number of breaches the password was found in, or null when not exposed/not checked. */
  exposedCount: number | null;
  /** Error message if the exposed-password check failed for this item, otherwise null. */
  exposedError: string | null;

  constructor(result: CipherRiskResult, name: string) {
    this.object = "password-health";
    this.id = uuidAsString(result.id);
    this.name = name;
    this.passwordStrength = result.password_strength;
    // SDK reports occurrence count (1 = unique), so only >1 counts as reused.
    this.reuseCount =
      result.reuse_count != null && result.reuse_count > 1 ? result.reuse_count : null;

    const exposed = result.exposed_result;
    this.exposed = exposed.type === "Found";
    this.exposedCount = exposed.type === "Found" ? exposed.value : null;
    this.exposedError = exposed.type === "Error" ? exposed.value : null;
  }
}
