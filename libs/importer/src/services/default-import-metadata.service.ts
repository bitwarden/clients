import { map, Observable } from "rxjs";

import { DeviceType } from "@bitwarden/common/enums";
import { SemanticLogger } from "@bitwarden/common/tools/log";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";

import { ImporterMetadata, ImportersMetadata, Loader } from "../metadata";
import { ImportType } from "../models/import-options";
import { availableLoaders } from "../util";

import { ImportMetadataServiceAbstraction } from "./import-metadata.service.abstraction";

export class DefaultImportMetadataService implements ImportMetadataServiceAbstraction {
  protected importers: ImportersMetadata = {};
  private logger: SemanticLogger;

  constructor(protected system: SystemServiceProvider) {
    this.logger = system.log({ type: "ImportMetadataService" });
  }

  async init(): Promise<void> {
    // no-op for default implementation
  }

  metadata$(type$: Observable<ImportType>): Observable<ImporterMetadata> {
    const client = this.system.environment.getClientType();
    const capabilities$ = type$.pipe(
      map((type) => {
        if (!this.importers) {
          return { type, loaders: [] };
        }

        let loaders = availableLoaders(this.importers, type, client);

        let isUnsupported = false;

        // FIXME Likely needs to be extended for Chrome and Edge as well
        if (type === "bravecsv") {
          try {
            const device = this.system.environment.getDevice();
            const isWindowsDesktop = device === DeviceType.WindowsDesktop;
            if (isWindowsDesktop) {
              isUnsupported = true;
            }
          } catch {
            isUnsupported = true;
          }
        }

        // If the feature flag is disabled, or if the browser is unsupported, remove the chromium loader
        if (isUnsupported) {
          loaders = loaders?.filter((loader) => loader !== Loader.chromium);
        }

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
}
