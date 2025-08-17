import { BaseResponse } from "@bitwarden/common/models/response/base.response";
// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, KdfConfig, KdfType, PBKDF2KdfConfig } from "@bitwarden/key-management";

export class KdfConfigResponse extends BaseResponse {
  kdfType: KdfType;
  iterations: number;
  memory?: number;
  parallelism?: number;

  constructor(response: unknown) {
    super(response);

    const kdfType = this.getResponseProperty("KdfType");
    if (kdfType == null || typeof kdfType !== "number") {
      throw new Error("KDF config response does not contain a valid KDF type");
    }
    this.kdfType = kdfType as KdfType;

    const iterations = this.getResponseProperty("Iterations");
    if (iterations == null || typeof iterations !== "number") {
      throw new Error("KDF config response does not contain a valid number of iterations");
    }
    this.iterations = iterations;

    if (this.kdfType === KdfType.Argon2id) {
      const memory = this.getResponseProperty("Memory");
      if (memory == null || typeof memory !== "number") {
        throw new Error("KDF config response does not contain a valid memory size for Argon2id");
      }
      const parallelism = this.getResponseProperty("Parallelism");
      if (parallelism == null || typeof parallelism !== "number") {
        throw new Error("KDF config response does not contain a valid parallelism for Argon2id");
      }
      this.memory = memory;
      this.parallelism = parallelism;
    }
  }

  toKdfConfig(): KdfConfig {
    switch (this.kdfType) {
      case KdfType.Argon2id:
        return new Argon2KdfConfig(this.iterations, this.memory!, this.parallelism!);
      case KdfType.PBKDF2_SHA256:
        return new PBKDF2KdfConfig(this.iterations);
    }
  }
}
