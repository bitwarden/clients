import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ImporterLoginResult } from "@bitwarden/importer-core";

/** Imports logins from an already-authorized profile. Shared by the new and legacy import flows. */
export async function loadChromiumLogins(
  browser: string,
  profileId: string,
  i18nService: I18nService,
): Promise<ImporterLoginResult[]> {
  try {
    return await ipc.tools.chromiumImporter.importLogins(browser, profileId);
  } catch {
    throw new Error(i18nService.t("errorOccurred"));
  }
}
