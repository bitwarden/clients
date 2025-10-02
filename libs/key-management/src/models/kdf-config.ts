import { Jsonify } from "type-fest";

import { RangeWithDefault } from "@bitwarden/common/platform/misc/range-with-default";
import { Kdf } from "@bitwarden/sdk-internal";

import { KdfType } from "../enums/kdf-type.enum";

/**
 * Represents a type safe KDF configuration.
 */
export type KdfConfig = PBKDF2KdfConfig | Argon2KdfConfig;

/**
 * Password-Based Key Derivation Function 2 (PBKDF2) KDF configuration.
 */
export class PBKDF2KdfConfig {
  static ITERATIONS = new RangeWithDefault(600_000, 2_000_000, 600_000);
  static PRELOGIN_ITERATIONS_MIN = 5000;
  kdfType: KdfType.PBKDF2_SHA256 = KdfType.PBKDF2_SHA256;
  iterations: number;

  constructor(iterations?: number) {
    this.iterations = iterations ?? PBKDF2KdfConfig.ITERATIONS.defaultValue;
  }

  /**
   * Validates the PBKDF2 KDF configuration for updating the KDF config.
   * A Valid PBKDF2 KDF configuration has KDF iterations between the 600_000 and 2_000_000.
   */
  validateKdfConfigForSetting(): void {
    if (!PBKDF2KdfConfig.ITERATIONS.inRange(this.iterations)) {
      throw new Error(
        `PBKDF2 iterations must be between ${PBKDF2KdfConfig.ITERATIONS.min} and ${PBKDF2KdfConfig.ITERATIONS.max}`,
      );
    }
  }

  /**
   * Validates the PBKDF2 KDF configuration for pre-login.
   * A Valid PBKDF2 KDF configuration has KDF iterations between the 5000 and 2_000_000.
   */
  validateKdfConfigForPrelogin(): void {
    if (PBKDF2KdfConfig.PRELOGIN_ITERATIONS_MIN > this.iterations) {
      throw new Error(
        `PBKDF2 iterations must be at least ${PBKDF2KdfConfig.PRELOGIN_ITERATIONS_MIN}, but was ${this.iterations}; possible pre-login downgrade attack detected.`,
      );
    }
  }

  static fromJSON(json: Jsonify<PBKDF2KdfConfig>): PBKDF2KdfConfig {
    return new PBKDF2KdfConfig(json.iterations);
  }

  toSdkConfig(): Kdf {
    return {
      pBKDF2: {
        iterations: this.iterations,
      },
    };
  }
}

/**
 * Argon2 KDF configuration.
 */
export class Argon2KdfConfig {
  static MEMORY = new RangeWithDefault(16, 1024, 64);
  static PARALLELISM = new RangeWithDefault(1, 16, 4);
  static ITERATIONS = new RangeWithDefault(2, 10, 3);

  static PRELOGIN_MEMORY_MIN = 16;
  static PRELOGIN_PARALLELISM_MIN = 1;
  static PRELOGIN_ITERATIONS_MIN = 2;

  kdfType: KdfType.Argon2id = KdfType.Argon2id;
  iterations: number;
  memory: number;
  parallelism: number;

  constructor(iterations?: number, memory?: number, parallelism?: number) {
    this.iterations = iterations ?? Argon2KdfConfig.ITERATIONS.defaultValue;
    this.memory = memory ?? Argon2KdfConfig.MEMORY.defaultValue;
    this.parallelism = parallelism ?? Argon2KdfConfig.PARALLELISM.defaultValue;
  }

  /**
   * Validates the Argon2 KDF configuration for updating the KDF config.
   * A Valid Argon2 KDF configuration has iterations between 2 and 10, memory between 16mb and 1024mb, and parallelism between 1 and 16.
   */
  validateKdfConfigForSetting(): void {
    if (!Argon2KdfConfig.ITERATIONS.inRange(this.iterations)) {
      throw new Error(
        `Argon2 iterations must be between ${Argon2KdfConfig.ITERATIONS.min} and ${Argon2KdfConfig.ITERATIONS.max}`,
      );
    }

    if (!Argon2KdfConfig.MEMORY.inRange(this.memory)) {
      throw new Error(
        `Argon2 memory must be between ${Argon2KdfConfig.MEMORY.min} MiB and ${Argon2KdfConfig.MEMORY.max} MiB`,
      );
    }

    if (!Argon2KdfConfig.PARALLELISM.inRange(this.parallelism)) {
      throw new Error(
        `Argon2 parallelism must be between ${Argon2KdfConfig.PARALLELISM.min} and ${Argon2KdfConfig.PARALLELISM.max}.`,
      );
    }
  }

  /**
   * Validates the Argon2 KDF configuration for pre-login.
   */
  validateKdfConfigForPrelogin(): void {
    if (Argon2KdfConfig.PRELOGIN_ITERATIONS_MIN > this.iterations) {
      throw new Error(
        `Argon2 iterations must be at least ${Argon2KdfConfig.PRELOGIN_ITERATIONS_MIN}, but was ${this.iterations}; possible pre-login downgrade attack detected.`,
      );
    }

    if (Argon2KdfConfig.PRELOGIN_MEMORY_MIN > this.memory) {
      throw new Error(
        `Argon2 memory must be at least ${Argon2KdfConfig.PRELOGIN_MEMORY_MIN} MiB, but was ${this.memory} MiB; possible pre-login downgrade attack detected.`,
      );
    }

    if (Argon2KdfConfig.PRELOGIN_PARALLELISM_MIN > this.parallelism) {
      throw new Error(
        `Argon2 parallelism must be at least ${Argon2KdfConfig.PRELOGIN_PARALLELISM_MIN}, but was ${this.parallelism}; possible pre-login downgrade attack detected.`,
      );
    }
  }

  static fromJSON(json: Jsonify<Argon2KdfConfig>): Argon2KdfConfig {
    return new Argon2KdfConfig(json.iterations, json.memory, json.parallelism);
  }

  toSdkConfig(): Kdf {
    return {
      argon2id: {
        iterations: this.iterations,
        memory: this.memory,
        parallelism: this.parallelism,
      },
    };
  }
}

export function fromSdkKdfConfig(sdkKdf: Kdf): KdfConfig {
  if ("pBKDF2" in sdkKdf) {
    return new PBKDF2KdfConfig(sdkKdf.pBKDF2.iterations);
  } else if ("argon2id" in sdkKdf) {
    return new Argon2KdfConfig(
      sdkKdf.argon2id.iterations,
      sdkKdf.argon2id.memory,
      sdkKdf.argon2id.parallelism,
    );
  } else {
    throw new Error("Unsupported KDF type");
  }
}

export const DEFAULT_KDF_CONFIG = new PBKDF2KdfConfig(PBKDF2KdfConfig.ITERATIONS.defaultValue);
