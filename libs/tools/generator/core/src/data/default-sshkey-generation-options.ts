import { SshKeyGenerationOptions } from "../types/sshkey-generation-options";

/** The default options for sshkey generation. */
export const DefaultRsaSshKeyGenerationOptions: Partial<SshKeyGenerationOptions> = Object.freeze({
  bits: 3072,
});

export const DefaultEd25519SshKeyGenerationOptions: Partial<SshKeyGenerationOptions> =
  Object.freeze({
    bits: null,
  });
