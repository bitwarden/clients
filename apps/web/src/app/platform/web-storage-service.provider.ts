import {
  AbstractStorageService,
  ClientLocations,
  ObservableStorageService,
  PossibleLocation,
  StorageServiceProvider,
} from "@bitwarden/storage-core";

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
