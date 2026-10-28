import { UpgradeImportType } from "./import-upgrade-options";

const CHROMIUM_BROWSER_NAMES: Partial<Record<UpgradeImportType, string>> = {
  edgecsv: "Microsoft Edge",
  operacsv: "Opera",
  bravecsv: "Brave",
  vivaldicsv: "Vivaldi",
  arccsv: "Arc",
};

// Chrome is the default: every chromium-family ImportType not listed above shares Chrome's own
// profile-storage format. Matches ImportChromeComponent's getBrowserName mapping.
export function chromiumBrowserNameFor(type: UpgradeImportType): string {
  return CHROMIUM_BROWSER_NAMES[type] ?? "Chrome";
}
