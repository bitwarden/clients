import { SystemServiceProvider } from "@bitwarden/common/tools/providers";
import type { chromium_importer } from "@bitwarden/desktop-napi";
import {
  ImportType,
  DefaultImportMetadataService,
  ImportMetadataServiceAbstraction,
  DataLoader,
  ImporterMetadata,
  InstructionLink,
  Instructions,
  Loader,
} from "@bitwarden/importer-core";

export class DesktopImportMetadataService
  extends DefaultImportMetadataService
  implements ImportMetadataServiceAbstraction
{
  constructor(system: SystemServiceProvider) {
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
    const entries = Object.entries(raw).map(([id, meta]) => {
      const loaders = meta.loaders.map(this.mapLoader);
      const instructions = this.mapInstructions(meta.instructions);
      const mapped: ImporterMetadata = {
        type: id as ImportType,
        loaders,
        ...(instructions ? { instructions } : {}),
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

  private mapInstructions(name: string): InstructionLink | undefined {
    switch (name) {
      case "chromium":
        return Instructions.chromium;
      default:
        return undefined;
    }
  }
}
