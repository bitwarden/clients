import {
  AbstractStorageService,
  ClientLocations,
  ObservableStorageService,
  PossibleLocation,
  StorageServiceProvider,
} from "@bitwarden/storage-core";

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
