import { CommandDefinition, CommandOutput } from "./command";

export interface NativeAutofillSyncCommand extends CommandDefinition {
  name: "sync";
  input: NativeAutofillSyncParams;
  output: NativeAutofillSyncResult;
}

export type NativeAutofillSyncParams = {
  credentials: NativeAutofillCredential[];
};

export type NativeAutofillCredential =
  | NativeAutofillFido2Credential
  | NativeAutofillPasswordCredential;

export type NativeAutofillFido2Credential = {
  type: "fido2";
  cipherId: string;
  rpId: string;
  userName: string;
  /** Should be Base64URL-encoded binary data */
  credentialId: string;
  /** Should be Base64URL-encoded binary data */
  userHandle: string;
};

export type NativeAutofillPasswordCredential = {
  type: "password";
  cipherId: string;
  uri: string;
  username: string;
};

export type NativeAutofillSyncResult = CommandOutput<{
  added: number;
}>;
