import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { StorageOptions } from "@bitwarden/common/platform/models/domain/storage-options";

import { BrowserApi } from "../browser/browser-api";
import { OffscreenDocumentService } from "../offscreen-document/abstractions/offscreen-document";

export class OffscreenStorageService implements AbstractStorageService {
  constructor(private readonly offscreenDocumentService: OffscreenDocumentService) {}

  get valuesRequireDeserialization(): boolean {
    return true;
  }

  async get<T>(key: string, options?: StorageOptions): Promise<T> {
    return await this.offscreenDocumentService.withDocument<T>(
      [chrome.offscreen.Reason.LOCAL_STORAGE],
      "backup storage of user data",
      async () => {
        const response = await BrowserApi.sendMessageWithResponse<string>("localStorageGet", {
          key,
        });
        if (response != null) {
          return JSON.parse(response);
        }

        return response;
      },
    );
  }
  async has(key: string, options?: StorageOptions): Promise<boolean> {
    return (await this.get(key, options)) != null;
  }

  async save<T>(key: string, obj: T, options?: StorageOptions): Promise<void> {
    await this.offscreenDocumentService.withDocument(
      [chrome.offscreen.Reason.LOCAL_STORAGE],
      "backup storage of user data",
      async () =>
        await BrowserApi.sendMessageWithResponse<void>("localStorageSave", {
          key,
          value: JSON.stringify(obj),
        }),
    );
  }
  async remove(key: string, options?: StorageOptions): Promise<void> {
    await this.offscreenDocumentService.withDocument(
      [chrome.offscreen.Reason.LOCAL_STORAGE],
      "backup storage of user data",
      async () =>
        await BrowserApi.sendMessageWithResponse<void>("localStorageRemove", {
          key,
        }),
    );
  }
}
