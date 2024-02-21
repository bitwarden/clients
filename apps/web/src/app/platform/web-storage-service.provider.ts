import {
  AbstractStorageService,
  ObservableStorageService,
} from "@bitwarden/common/platform/abstractions/storage.service";
import {
  PossibleLocation,
  StorageServiceProvider,
} from "@bitwarden/common/platform/services/storage-service.provider";
import {
  StorageLocation,
  ClientLocations,
  // eslint-disable-next-line import/no-restricted-paths
} from "@bitwarden/common/platform/state/state-definition";

export class WebStorageServiceProvider extends StorageServiceProvider {
  constructor(
    diskStorageService: AbstractStorageService & ObservableStorageService,
    memoryStorageService: AbstractStorageService & ObservableStorageService,
    private readonly diskLocalStorageService: AbstractStorageService & ObservableStorageService,
  ) {
    super(diskStorageService, memoryStorageService);
  }

  override get(
    defaultLocation: StorageLocation,
    overrides: Partial<ClientLocations>,
  ): [location: PossibleLocation, service: AbstractStorageService & ObservableStorageService] {
    const location = overrides["web"] ?? defaultLocation;
    switch (location) {
      case "disk":
        return ["disk", this.diskStorageService];
      case "memory":
        return ["memory", this.memoryStorageService];
      case "disk-local":
        return ["disk-local", this.diskLocalStorageService];
      default:
        throw new Error(`Unexpected location: ${location}`);
    }
  }
}
