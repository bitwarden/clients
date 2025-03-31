import { Jsonify } from "type-fest";

import { CredentialAlgorithm } from "@bitwarden/generator-core";

/** A credential generation result */
export class GeneratedCredential {
  /**
   * Instantiates a generated credential
   * @param credential The value of the generated credential (e.g. a password)
   * @param category The kind of credential
   * @param generationDate The date that the credential was generated.
   *   Numeric values should are interpreted using {@link Date.valueOf}
   *   semantics.
   */
  constructor(
    readonly credential: string,
    readonly category: CredentialAlgorithm,
    generationDate: Date | number,
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
    );
  }

  /** Serializes a credential to a JSON-compatible object */
  toJSON() {
    return {
      credential: this.credential,
      category: this.category,
      generationDate: this.generationDate.valueOf(),
    };
  }
}
