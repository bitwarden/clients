import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";
import type { chromium_importer } from "@bitwarden/desktop-napi";
import {
  ImportType,
  ImportOptionData,
  DefaultImportMetadataService,
  ImportMetadataServiceAbstraction,
  ImporterLoginResult,
  ImporterProfile,
  DataLoader,
  Loader,
  chromiumBrowserNameFor,
} from "@bitwarden/importer-core";

import { loadChromiumLogins } from "./chromium-login-loader";
import { loadChromiumProfiles } from "./chromium-profile-loader";

export class DesktopImportMetadataService
  extends DefaultImportMetadataService
  implements ImportMetadataServiceAbstraction
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
          ...this.importers[id as ImportType],
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

  async getAvailableProfiles(type: ImportType): Promise<ImporterProfile[]> {
    return loadChromiumProfiles(chromiumBrowserNameFor(type), this.i18nService);
  }

  async getChromiumLogins(type: ImportType, profileId: string): Promise<ImporterLoginResult[]> {
    return loadChromiumLogins(chromiumBrowserNameFor(type), profileId, this.i18nService);
  }
}
