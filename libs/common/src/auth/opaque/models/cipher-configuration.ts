import { CipherConfiguration as CipherConfigurationSdk } from "@bitwarden/sdk-internal";

// TODO: add js docs to all types / classes here.

export type CipherSuite = OPAQUEKE3_RISTRETTO255_3DH_ARGON2ID13_SUITE;
export type OPAQUEKE3_RISTRETTO255_3DH_ARGON2ID13_SUITE =
  "OPAQUE_3_RISTRETTO255_OPRF_RISTRETTO255_KEGROUP_3DH_KEX_ARGON2ID13_KSF";

export class CipherConfiguration {
  cipherSuite: CipherSuite;
  argon2Parameters: Argon2IdParameters;

  // only support one ciphersuite for now
  constructor(ksf: Argon2IdParameters) {
    this.cipherSuite = "OPAQUE_3_RISTRETTO255_OPRF_RISTRETTO255_KEGROUP_3DH_KEX_ARGON2ID13_KSF";
    this.argon2Parameters = ksf;
  }

  toSdkConfig(): CipherConfigurationSdk {
    if (
      this.cipherSuite !== "OPAQUE_3_RISTRETTO255_OPRF_RISTRETTO255_KEGROUP_3DH_KEX_ARGON2ID13_KSF"
    ) {
      throw new Error("Unsupported cipher suite");
    } else {
      return {
        oprf_cs: "ristretto255",
        ke_group: "ristretto255",
        key_exchange: "triple-dh",
        ksf: {
          argon2id: [
            this.argon2Parameters.memory,
            this.argon2Parameters.iterations,
            this.argon2Parameters.parallelism,
          ],
        },
      };
    }
  }
}

export type Argon2IdParameters = {
  // Memory in KiB
  memory: number;
  iterations: number;
  parallelism: number;
};
