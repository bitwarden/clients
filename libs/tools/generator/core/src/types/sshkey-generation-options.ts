/** Request key parameters for sshkey credential generation.
 */
export type RsaSshKeyGenerationOptions = {
  /** The key size of a variable-length `keyAlgorithm` in bits.
   *  `null` when the selected key has a fixed width.
   */
  bits: number;
};

export type Ed25519KeyGenrationOptions = Record<string, never>;
