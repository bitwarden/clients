import { map, Observable } from "rxjs";

import { SemanticLogger } from "@bitwarden/common/tools/log";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";

import { ImporterMetadata, ImportersMetadata } from "../metadata";
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

        const loaders = availableLoaders(this.importers, type, client);

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
