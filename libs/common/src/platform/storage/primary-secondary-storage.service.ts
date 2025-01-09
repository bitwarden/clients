import { AbstractStorageService, ObservableStorageService } from "../abstractions/storage.service";
import { StorageOptions } from "../models/domain/storage-options";

export class PrimarySecondaryStorageService
  implements AbstractStorageService, ObservableStorageService
{
  // Only follow the primary storage service as updates should all be done to both
  updates$ = this.primaryStorageService.updates$;

  constructor(
    private readonly primaryStorageService: AbstractStorageService & ObservableStorageService,
    // Secondary service doesn't need to be observable as the only `updates$` are listened to from the primary store
    private readonly secondaryStorageService: AbstractStorageService,
  ) {
    if (
      primaryStorageService.valuesRequireDeserialization !==
      secondaryStorageService.valuesRequireDeserialization
    ) {
      throw new Error(
        "Differing values for valuesRequireDeserialization between storage services is not supported.",
      );
    }
  }
  get valuesRequireDeserialization(): boolean {
    return this.primaryStorageService.valuesRequireDeserialization;
  }

  async get<T>(key: string, options?: StorageOptions): Promise<T> {
    const primaryValue = await this.primaryStorageService.get<T>(key, options);

    // If it's null-ish try the secondary location for its value
    if (primaryValue == null) {
      return await this.secondaryStorageService.get<T>(key, options);
    }

    return primaryValue;
  }

  async has(key: string, options?: StorageOptions): Promise<boolean> {
    return (
      (await this.primaryStorageService.has(key, options)) ||
      (await this.secondaryStorageService.has(key, options))
    );
  }

  async save<T>(key: string, obj: T, options?: StorageOptions): Promise<void> {
    await Promise.allSettled([
      this.primaryStorageService.save(key, obj, options),
      this.secondaryStorageService.save(key, obj, options),
    ]);
  }

  async remove(key: string, options?: StorageOptions): Promise<void> {
    await Promise.allSettled([
      this.primaryStorageService.remove(key, options),
      this.secondaryStorageService.remove(key, options),
    ]);
  }
}
