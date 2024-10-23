import {
  Ed25519KeyGenrationOptions,
  RsaSshKeyGenerationOptions,
} from "../types/sshkey-generation-options";

/** The default options for sshkey generation. */
export const DefaultRsaSshKeyGenerationOptions: Partial<RsaSshKeyGenerationOptions> = Object.freeze(
  {
    bits: 3072,
  },
);

export const DefaultEd25519SshKeyGenerationOptions: Partial<Ed25519KeyGenrationOptions> =
  Object.freeze({});
