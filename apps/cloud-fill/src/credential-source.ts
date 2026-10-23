import type { LoginFillCredential } from "@bitwarden/browser/autofill/utils/login-fill-script";

/** Supplies a credential for an origin the extension itself derived from the top frame. */
export interface CredentialSource {
  request(origin: string): Promise<LoginFillCredential | null>;
}
