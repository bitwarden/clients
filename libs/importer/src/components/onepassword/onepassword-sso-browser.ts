import { Injectable } from "@angular/core";

/**
 * The browser step of a 1Password single sign-on import: where the user signs in with the identity
 * provider. 1Password hands the user back to the identity provider's redirect address, which only a
 * client that hosts the sign-in page itself can intercept, so such a client provides its own
 * implementation. Every other one gets an unsupported default and does not offer single sign-on.
 */
@Injectable({
  providedIn: "root",
  useFactory: () => new UnsupportedOnePasswordSsoBrowser(),
})
export abstract class OnePasswordSsoBrowser {
  /** Whether this client can take the user through the identity provider's sign-in. */
  abstract readonly supported: boolean;

  /**
   * Has the user sign in at `ssoLoginUrl` and waits for the identity provider to redirect to
   * `redirectTo`.
   *
   * @returns the full address the identity provider redirected to, which carries the authorization
   * code, or `undefined` if the user gave up.
   */
  abstract login(ssoLoginUrl: string, redirectTo: string): Promise<string | undefined>;

  /** Gives up on a login that is still waiting. Does nothing when there is none. */
  abstract cancel(): void;
}

class UnsupportedOnePasswordSsoBrowser extends OnePasswordSsoBrowser {
  readonly supported = false;

  login(): Promise<string | undefined> {
    return Promise.reject(new Error("1Password single sign-on is not supported in this client."));
  }

  cancel(): void {
    return;
  }
}
