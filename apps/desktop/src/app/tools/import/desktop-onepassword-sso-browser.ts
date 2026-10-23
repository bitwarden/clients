import { OnePasswordSsoBrowser } from "@bitwarden/importer-ui";

/** Signs in to 1Password with its identity provider in a window of the main process. */
export class DesktopOnePasswordSsoBrowser extends OnePasswordSsoBrowser {
  readonly supported = true;

  async login(ssoLoginUrl: string, redirectTo: string): Promise<string | undefined> {
    return (await ipc.tools.onePasswordSso.login(ssoLoginUrl, redirectTo)) ?? undefined;
  }

  cancel(): void {
    void ipc.tools.onePasswordSso.cancel();
  }
}
