import {
  AbstractStorageService,
  ObservableStorageService,
} from "@bitwarden/common/platform/abstractions/storage.service";
import {
  PossibleLocation,
  StorageServiceProvider,
} from "@bitwarden/common/platform/services/storage-service.provider";
// eslint-disable-next-line import/no-restricted-paths
import { ClientLocations } from "@bitwarden/common/platform/state/state-definition";

export class BrowserStorageServiceProvider extends StorageServiceProvider {
  constructor(
    diskStorageService: AbstractStorageService & ObservableStorageService,
    limitedMemoryStorageService: AbstractStorageService & ObservableStorageService,
    private largeObjectMemoryStorageService: AbstractStorageService & ObservableStorageService,
    private readonly diskBackupLocalStorage: AbstractStorageService & ObservableStorageService,
  ) {
    super(diskStorageService, limitedMemoryStorageService);
  }

  override get(
    defaultLocation: PossibleLocation,
    overrides: Partial<ClientLocations>,
  ): [location: PossibleLocation, service: AbstractStorageService & ObservableStorageService] {
    const location = overrides["browser"] ?? defaultLocation;
    switch (location) {
      case "memory-large-object":
        return ["memory-large-object", this.largeObjectMemoryStorageService];
      case "disk-backup-local-storage":
        return ["disk-backup-local-storage", this.diskBackupLocalStorage];
      default:
        // Pass in computed location to super because they could have
        // override default "disk" with web "memory".
        return super.get(location, overrides);
    }
  }
}
