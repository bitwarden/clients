import type { LoginFillCredential } from "@bitwarden/browser/autofill/utils/login-fill-script";

import type { CredentialSource } from "./credential-source";

const TEST_HOSTNAME = "localhost";

/** Hardcoded throwaway credential for local testing. It is bound to one hostname. */
export class StaticCredentialSource implements CredentialSource {
  request(origin: string): Promise<LoginFillCredential | null> {
    if (new URL(origin).hostname !== TEST_HOSTNAME) {
      return Promise.resolve(null);
    }
    return Promise.resolve({ username: "spike-user@example.test", password: "spike-Pa55w0rd!" });
  }
}
