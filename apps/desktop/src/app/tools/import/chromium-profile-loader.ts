import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import type { chromium_importer } from "@bitwarden/desktop-napi";
import { ImporterProfile } from "@bitwarden/importer-core";

/** Requests OS-level access to the given browser's profile directory (a no-op outside a
 *  sandboxed build), then reads its available profiles. Shared by DesktopImportMetadataService
 *  (the new ImportControlsComponent flow) and ImportDesktopComponent (the legacy import dialog),
 *  since both flows load the same native module the same way. */
export async function loadChromiumProfiles(
  browser: string,
  i18nService: I18nService,
): Promise<ImporterProfile[]> {
  // Strings shown by the native NSOpenPanel are resolved here, where the i18n service lives,
  // and threaded through to ObjC via IPC. The native side only injects the resolved filesystem
  // path it computes on its own.
  const pickerStrings: chromium_importer.PickerStrings = {
    message: i18nService.t("chromiumImporterPickerMessage", browser),
    expectedLocationLabel: i18nService.t("chromiumImporterPickerExpectedLocation"),
    prompt: i18nService.t("chromiumImporterPickerPrompt"),
  };

  try {
    // Request browser access (required for sandboxed builds, no-op otherwise)
    await ipc.tools.chromiumImporter.requestBrowserAccess(browser, pickerStrings);
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "";

    // Check verbose error chain for specific i18n key indicating browser not installed
    const browserNotInstalledMatch = rawMessage.match(
      /chromiumImporterBrowserNotInstalled:([^:]+)/,
    );

    const message = browserNotInstalledMatch
      ? i18nService.t("chromiumImporterBrowserNotInstalled", browserNotInstalledMatch[1])
      : i18nService.t("browserAccessDenied");

    throw new Error(message);
  }

  try {
    return await ipc.tools.chromiumImporter.getAvailableProfiles(browser);
  } catch {
    throw new Error(i18nService.t("errorOccurred"));
  }
}
