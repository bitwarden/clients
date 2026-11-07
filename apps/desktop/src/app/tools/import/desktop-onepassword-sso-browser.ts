import { OnePasswordSsoBrowser, OnePasswordSsoSignInClosedError } from "@bitwarden/importer-ui";

/** Signs in to 1Password with its identity provider in a window of the main process. */
export class DesktopOnePasswordSsoBrowser extends OnePasswordSsoBrowser {
  readonly supported = true;

  async login(ssoLoginUrl: string, redirectTo: string): Promise<string | undefined> {
    const outcome = await ipc.tools.onePasswordSso.login(ssoLoginUrl, redirectTo);
    switch (outcome.status) {
      case "redirected":
        return outcome.redirectedTo;
      case "closed":
        throw new OnePasswordSsoSignInClosedError();
      case "canceled":
        return undefined;
    }
  }

  cancel(): void {
    void ipc.tools.onePasswordSso.cancel();
  }
}
