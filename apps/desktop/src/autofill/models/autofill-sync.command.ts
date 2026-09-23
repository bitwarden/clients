import { AutofillCommandDefinition, AutofillCommandOutput } from "./autofill-command";

export interface AutofillSyncCommand extends AutofillCommandDefinition {
  name: "sync";
  input: AutofillSyncParams;
  output: AutofillSyncResult;
}

export type AutofillSyncParams = {
  credentials: AutofillCredential[];
};

export type AutofillCredential = AutofillFido2Credential | AutofillPasswordCredential;

export type AutofillFido2Credential = {
  type: "fido2";
  cipherId: string;
  rpId: string;
  userName: string;
  /** Should be Base64URL-encoded binary data */
  credentialId: string;
  /** Should be Base64URL-encoded binary data */
  userHandle: string;
};

export type AutofillPasswordCredential = {
  type: "password";
  cipherId: string;
  uri: string;
  username: string;
};

export type AutofillSyncResult = AutofillCommandOutput<{
  added: number;
}>;
