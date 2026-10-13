import { Jsonify } from "type-fest";

import { CredentialType } from "@bitwarden/generator-core";

/** A credential generation result */
export class GeneratedCredential {
  /**
   * Instantiates a generated credential
   * @param credential The value of the generated credential (e.g. a password)
   * @param category The kind of credential
   * @param generationDate The date that the credential was generated.
   *   Numeric values should are interpreted using {@link Date.valueOf}
   *   semantics.
   * @param algorithm The string id of the algorithm used to generate the credential.
   *   Disambiguates sub-types within a {@link CredentialType} (e.g. `password` vs `passphrase`).
   *   Stored as a plain string so the JSON shape stays compatible with `SecretClassifier`'s
   *   strict typing. Forwarder algorithm ids (object form) are not persisted here.
   */
  constructor(
    readonly credential: string,
    readonly category: CredentialType,
    generationDate: Date | number,
    readonly algorithm?: string,
  ) {
    if (typeof generationDate === "number") {
      this.generationDate = new Date(generationDate);
    } else {
      this.generationDate = generationDate;
    }
  }

  /** The date that the credential was generated */
  generationDate: Date;

  /** Constructs a credential from its `toJSON` representation */
  static fromJSON(jsonValue: Jsonify<GeneratedCredential>) {
    return new GeneratedCredential(
      jsonValue.credential,
      jsonValue.category,
      jsonValue.generationDate,
      jsonValue.algorithm,
    );
  }

  /** Serializes a credential to a JSON-compatible object */
  toJSON(): {
    credential: string;
    category: CredentialType;
    generationDate: number;
    algorithm?: string;
  } {
    const json: {
      credential: string;
      category: CredentialType;
      generationDate: number;
      algorithm?: string;
    } = {
      credential: this.credential,
      category: this.category,
      generationDate: this.generationDate.valueOf(),
    };
    if (this.algorithm !== undefined) {
      json.algorithm = this.algorithm;
    }
    return json;
  }
}
