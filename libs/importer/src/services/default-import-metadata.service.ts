import { map, Observable } from "rxjs";

import { SemanticLogger } from "@bitwarden/common/tools/log";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";

import { importOptionsById, ImportOptionData, ImportType } from "../models/import-options";
import { availableLoaders } from "../util";

import {
  ImporterCapabilities,
  ImportMetadataServiceAbstraction,
} from "./import-metadata.service.abstraction";

export class DefaultImportMetadataService implements ImportMetadataServiceAbstraction {
  protected importers: Record<ImportType, ImportOptionData> = importOptionsById;
  private logger: SemanticLogger;

  constructor(protected system: SystemServiceProvider) {
    this.logger = system.log({ type: "ImportMetadataService" });
  }

  async init(): Promise<void> {
    // no-op for default implementation
  }

  metadata$(type$: Observable<ImportType>): Observable<ImporterCapabilities> {
    const client = this.system.environment.getClientType();
    const capabilities$ = type$.pipe(
      map((type) => {
        const loaders = availableLoaders(this.importers, type, client);
        const capabilities: ImporterCapabilities = { type, loaders };

        this.logger.debug({ importType: type, capabilities }, "capabilities updated");

        return capabilities;
      }),
    );

    return capabilities$;
  }
}
