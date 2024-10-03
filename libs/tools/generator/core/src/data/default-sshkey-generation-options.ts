import { SshKeyGenerationOptions } from "../types/sshkey-generation-options";

/** The default options for sshkey generation. */
export const DefaultSshKeyGenerationOptions: Partial<SshKeyGenerationOptions> = Object.freeze({
  keyAlgorithm: "ed25519",
  bits: null,
});
