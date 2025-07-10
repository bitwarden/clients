import {
  AbstractStorageService,
  ObservableStorageService,
} from "@bitwarden/common/platform/abstractions/storage.service";
import {
  PossibleLocation,
  StorageServiceProvider,
} from "@bitwarden/common/platform/services/storage-service.provider";
import {
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
    defaultLocation: PossibleLocation,
    overrides: Partial<ClientLocations>,
  ): [location: PossibleLocation, service: AbstractStorageService & ObservableStorageService] {
    const location = overrides["web"] ?? defaultLocation;
    switch (location) {
      case "disk-local":
        return ["disk-local", this.diskLocalStorageService];
      default:
        // Pass in computed location to super because they could have
        // overriden default "disk" with web "memory".
        return super.get(location, overrides);
    }
  }
}
