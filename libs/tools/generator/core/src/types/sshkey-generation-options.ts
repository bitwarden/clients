/** Request key parameters for sshkey credential generation.
 *  Length may only be specified for rsa keys.
 */
export type SshKeyGenerationOptions = {
  /** The key size of a variable-length `keyAlgorithm` in bits.
   *  `null` when the selected key has a fixed width.
   */
  bits: number | null;
};
