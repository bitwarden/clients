import { combineLatest, map, Observable } from "rxjs";

import { ClientType, DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { SemanticLogger } from "@bitwarden/common/tools/log";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";

import { DataLoader, ImporterMetadata, Importers, ImportersMetadata, Loader } from "../metadata";
import { ImportType } from "../models/import-options";
import { availableLoaders } from "../util";

import { ImportMetadataServiceAbstraction } from "./import-metadata.service.abstraction";

export class DefaultImportMetadataService implements ImportMetadataServiceAbstraction {
  protected importers: ImportersMetadata = Importers;
  private logger: SemanticLogger;

  private chromiumWithABE$: Observable<boolean>;

  constructor(protected system: SystemServiceProvider) {
    this.logger = system.log({ type: "ImportMetadataService" });
    this.chromiumWithABE$ = this.system.configService.getFeatureFlag$(
      FeatureFlag.ChromiumImporterWithABE,
    );
  }

  async init(): Promise<void> {
    // no-op for default implementation
  }

  metadata$(type$: Observable<ImportType>): Observable<ImporterMetadata> {
    const client = this.system.environment.getClientType();
    const capabilities$ = combineLatest([type$, this.chromiumWithABE$]).pipe(
      map(([type, enabled]) => {
        if (!this.importers) {
          return { type, loaders: [] };
        }

        const loaders = this.availableLoaders(this.importers, type, client, enabled);

        if (!loaders || loaders.length === 0) {
          return { type, loaders: [] };
        }

        const capabilities: ImporterMetadata = { type, loaders };
        if (type in this.importers) {
          capabilities.instructions = this.importers[type]?.instructions;
        }

        this.logger.debug({ importType: type, capabilities }, "capabilities updated");

        return capabilities;
      }),
    );

    return capabilities$;
  }

  /** Determine the available loaders for the given import type and client, considering feature flags and environments */
  private availableLoaders(
    importers: ImportersMetadata,
    type: ImportType,
    client: ClientType,
    withABESupport: boolean,
  ): DataLoader[] | undefined {
    let loaders = availableLoaders(importers, type, client);

    if (withABESupport) {
      return loaders;
    }

    // Special handling for Brave, Chrome, and Edge CSV imports on Windows Desktop
    if (type === "bravecsv" || type === "chromecsv" || type === "edgecsv") {
      try {
        const device = this.system.environment.getDevice();
        const isWindowsDesktop = device === DeviceType.WindowsDesktop;
        if (isWindowsDesktop) {
          // Exclude the Chromium loader if on Windows Desktop without ABE support
          loaders = loaders?.filter((loader) => loader !== Loader.chromium);
        }
      } catch {
        loaders = loaders?.filter((loader) => loader !== Loader.chromium);
      }
    }

    return loaders;
  }
}
