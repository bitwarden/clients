import { Jsonify } from "type-fest";

import { CredentialType } from "../metadata";

/** A credential generation result */
export class GeneratedCredential {
  /**
   * Instantiates a generated credential
   * @param credential The value of the generated credential (e.g. a password)
   * @param category The type of credential
   * @param generationDate The date that the credential was generated.
   *   Numeric values should are interpreted using {@link Date.valueOf}
   *   semantics.
   * @param source traces the origin of the request that generated this credential.
   * @param website traces the website associated with the generated credential.
   */
  constructor(
    readonly credential: string,
    // FIXME: create a way to migrate the data stored in `category` to a new `type`
    //   field. The hard part: This requires the migration occur post-decryption.
    readonly category: CredentialType,
    generationDate: Date | number,
    readonly source?: string,
    readonly website?: string,
  ) {
    if (typeof generationDate === "number") {
      this.generationDate = new Date(generationDate);
    } else {
      this.generationDate = generationDate;
    }
  }

  /** The date that the credential was generated */
  readonly generationDate: Date;

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
    // omits the source and website because they were introduced to solve
    // UI bugs and it's not yet known whether there's a desire to support
    // them in the generator history view.
    return {
      credential: this.credential,
      category: this.category,
      generationDate: this.generationDate.valueOf(),
    };
  }
}
