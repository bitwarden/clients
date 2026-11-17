import { is_valid_cidr } from "@bitwarden/sdk-internal";

import { CidrValidationService } from "./cidr-validation.service";

/**
 * Calls the SDK's `is_valid_cidr`, available synchronously once the WASM module loads at startup.
 * It requires a prefix and rejects host bits set past it, such as `10.0.0.1/8`.
 */
export class DefaultCidrValidationService extends CidrValidationService {
  isValid(value: string): boolean {
    return is_valid_cidr(value);
  }
}
