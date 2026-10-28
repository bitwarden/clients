import { map, Observable } from "rxjs";

import { SemanticLogger } from "@bitwarden/common/tools/log";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";

import { LoaderAvailability } from "../metadata";
import { ImportOptionData } from "../models/import-options";
import { importUpgradeOptionsById, UpgradeImportType } from "../models/import-upgrade-options";

import {
  ImporterLoginResult,
  ImporterProfile,
  ImporterUpgradeCapabilities,
  ImportUpgradeMetadataServiceAbstraction,
} from "./import-upgrade-metadata.service.abstraction";

// TODO: remove once pm-35053-import-upgrade is retired
export class DefaultImportUpgradeMetadataService implements ImportUpgradeMetadataServiceAbstraction {
  protected importers: Record<UpgradeImportType, ImportOptionData> = importUpgradeOptionsById;
  private logger: SemanticLogger;

  constructor(protected system: SystemServiceProvider) {
    this.logger = system.log({ type: "ImportUpgradeMetadataService" });
  }

  async init(): Promise<void> {
    // no-op for default implementation
  }

  metadata$(type$: Observable<UpgradeImportType>): Observable<ImporterUpgradeCapabilities> {
    const client = this.system.environment.getClientType();
    const capabilities$ = type$.pipe(
      map((type) => {
        const loaders = (this.importers[type]?.loaders ?? []).filter((loader) =>
          LoaderAvailability[loader].includes(client),
        );
        const capabilities: ImporterUpgradeCapabilities = { type, loaders };

        this.logger.debug({ importType: type, capabilities }, "capabilities updated");

        return capabilities;
      }),
    );

    return capabilities$;
  }

  async getAvailableProfiles(type: UpgradeImportType): Promise<ImporterProfile[]> {
    return [];
  }

  async getChromiumLogins(
    type: UpgradeImportType,
    profileId: string,
  ): Promise<ImporterLoginResult[]> {
    return [];
  }
}
