import { ClientLocations } from "./client-locations";
import { StorageLocation } from "./storage-location";
import { StorageService, ObservableStorageService } from "./storage.service";

export type PossibleLocation = StorageLocation | ClientLocations[keyof ClientLocations];

/**
 * A provider for getting client specific computed storage locations and services.
 */
export class StorageServiceProvider {
  constructor(
    protected readonly diskStorageService: StorageService & ObservableStorageService,
    protected readonly memoryStorageService: StorageService & ObservableStorageService,
  ) {}

  /**
   * Computes the location and corresponding service for a given client.
   *
   * **NOTE** The default implementation does not respect client overrides and if clients
   * have special overrides they are responsible for implementing this service.
   * @param defaultLocation The default location to use if no client specific override is preferred.
   * @param overrides Client specific overrides
   * @returns The computed storage location and corresponding storage service to use to get/store state.
   * @throws If there is no configured storage service for the given inputs.
   */
  get(
    defaultLocation: PossibleLocation,
    overrides: Partial<ClientLocations>,
  ): [location: PossibleLocation, service: StorageService & ObservableStorageService] {
    switch (defaultLocation) {
      case "disk":
        return [defaultLocation, this.diskStorageService];
      case "memory":
        return [defaultLocation, this.memoryStorageService];
      default:
        throw new Error(`Unexpected location: ${defaultLocation}`);
    }
  }
}
