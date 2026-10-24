import type { LoginFillCredential } from "@bitwarden/browser/autofill/utils/login-fill-script";

export interface CredentialSource {
  request(origin: string): Promise<LoginFillCredential | null>;
}
