import { combineLatest, map, Observable } from "rxjs";

import { DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { SemanticLogger } from "@bitwarden/common/tools/log";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";

import { ImporterMetadata, ImportersMetadata, Loader } from "../metadata";
import { ImportType } from "../models/import-options";
import { availableLoaders } from "../util";

import { ImportMetadataServiceAbstraction } from "./import-metadata.service.abstraction";

export class DefaultImportMetadataService implements ImportMetadataServiceAbstraction {
  protected importers: ImportersMetadata = undefined;
  private logger: SemanticLogger;

  constructor(protected system: SystemServiceProvider) {
    this.logger = system.log({ type: "ImportMetadataService" });
  }

  async init(): Promise<void> {
    // no-op for default implementation
  }

  metadata$(type$: Observable<ImportType>): Observable<ImporterMetadata> {
    const browserEnabled$ = this.system.configService.getFeatureFlag$(
      FeatureFlag.UseChromiumImporter,
    );
    const client = this.system.environment.getClientType();
    const capabilities$ = combineLatest([type$, browserEnabled$]).pipe(
      map(([type, enabled]) => {
        if (!this.importers) {
          return undefined;
        }

        let loaders = availableLoaders(this.importers, type, client);

        let isUnsupported = false;

        if (enabled && type === "bravecsv") {
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
        if (!enabled || isUnsupported) {
          loaders = loaders?.filter((loader) => loader !== Loader.chromium);
        }

        const capabilities: ImporterMetadata = { type, loaders };
        if (type in this.importers) {
          capabilities.instructions = this.importers[type].instructions;
        }

        this.logger.debug({ importType: type, capabilities }, "capabilities updated");

        return capabilities;
      }),
    );

    return capabilities$;
  }
}
