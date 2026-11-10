import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";
import type { chromium_importer } from "@bitwarden/desktop-napi";
import {
  UpgradeImportType,
  ImportOptionData,
  DefaultImportUpgradeMetadataService,
  ImportUpgradeMetadataServiceAbstraction,
  ImporterLoginResult,
  ImporterProfile,
  DataLoader,
  Loader,
  chromiumBrowserNameFor,
} from "@bitwarden/importer-core";

import { loadChromiumLogins } from "./chromium-login-loader";
import { loadChromiumProfiles } from "./chromium-profile-loader";

// TODO: remove once pm-35053-import-upgrade is retired
export class DesktopImportUpgradeMetadataService
  extends DefaultImportUpgradeMetadataService
  implements ImportUpgradeMetadataServiceAbstraction
{
  constructor(
    system: SystemServiceProvider,
    private i18nService: I18nService,
  ) {
    super(system);
  }

  async init(): Promise<void> {
    const metadata = await ipc.tools.chromiumImporter.getMetadata();
    await this.parseNativeMetaData(metadata);
    await super.init();
  }

  private async parseNativeMetaData(
    raw: Record<string, chromium_importer.NativeImporterMetadata>,
  ): Promise<void> {
    // The native module can return ids that aren't real `ImportType`s (e.g. a generic
    // "chromiumcsv" entry with no UI-selectable counterpart) — skip those rather than let
    // an unchecked cast inject a phantom key into `this.importers`.
    const entries = Object.entries(raw)
      .filter(([id]) => id in this.importers)
      .map(([id, meta]) => {
        const loaders = meta.loaders.map(this.mapLoader);
        const mapped: ImportOptionData = {
          ...this.importers[id as UpgradeImportType],
          loaders,
        };
        return [id, mapped] as const;
      });

    // Do not overwrite existing importers, just add new ones or update existing ones
    this.importers = {
      ...this.importers,
      ...Object.fromEntries(entries),
    };
  }

  private mapLoader(name: string): DataLoader {
    switch (name) {
      case "file":
        return Loader.file;
      case "chromium":
        return Loader.chromium;
      default:
        throw new Error(`Unknown loader from native module: ${name}`);
    }
  }

  async getAvailableProfiles(type: UpgradeImportType): Promise<ImporterProfile[]> {
    return loadChromiumProfiles(chromiumBrowserNameFor(type), this.i18nService);
  }

  async getChromiumLogins(
    type: UpgradeImportType,
    profileId: string,
  ): Promise<ImporterLoginResult[]> {
    return loadChromiumLogins(chromiumBrowserNameFor(type), profileId, this.i18nService);
  }
}
