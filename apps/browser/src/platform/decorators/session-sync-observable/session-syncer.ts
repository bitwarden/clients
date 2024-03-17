import { BehaviorSubject, concatMap, ReplaySubject, skip, Subject, Subscription } from "rxjs";

import { AbstractMemoryStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { BrowserApi } from "../../browser/browser-api";

import { SyncedItemMetadata } from "./sync-item-metadata";

export class SessionSyncer {
  subscription: Subscription;
  id = Utils.newGuid();

  // ignore initial values
  private ignoreNUpdates = 0;

  constructor(
    private subject: Subject<any>,
    private memoryStorageService: AbstractMemoryStorageService,
    private metaData: SyncedItemMetadata,
  ) {
    if (!(subject instanceof Subject)) {
      throw new Error("subject must inherit from Subject");
    }

    if (metaData.initializer == null) {
      throw new Error("initializer must be provided");
    }
  }

  async init() {
    switch (this.subject.constructor) {
      case ReplaySubject:
        // ignore all updates currently in the buffer
        this.ignoreNUpdates = (this.subject as any)._buffer.length;
        break;
      case BehaviorSubject:
        this.ignoreNUpdates = 1;
        break;
      default:
        break;
    }

    await this.observe();
    // must be synchronous
    const hasInSessionMemory = await this.memoryStorageService.has(this.metaData.sessionKey);
    if (hasInSessionMemory) {
      await this.updateFromMemory();
    }

    this.listenForUpdates();
  }

  private async observe() {
    const stream = this.subject.pipe(skip(this.ignoreNUpdates));
    this.ignoreNUpdates = 0;

    // This may be a memory leak.
    // There is no good time to unsubscribe from this observable. Hopefully Manifest V3 clears memory from temporary
    // contexts. If so, this is handled by destruction of the context.
    this.subscription = stream
      .pipe(
        concatMap(async (next) => {
          if (this.ignoreNUpdates > 0) {
            this.ignoreNUpdates -= 1;
            return;
          }
          await this.updateSession(next);
        }),
      )
      .subscribe();
  }

  private listenForUpdates() {
    // This is an unawaited promise, but it will be executed asynchronously in the background.
    BrowserApi.messageListener(this.updateMessageCommand, (message) => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.updateFromMessage(message);
    });
  }

  async updateFromMessage(message: any) {
    if (message.command != this.updateMessageCommand || message.id === this.id) {
      return;
    }
    await this.update(message.serializedValue);
  }

  async updateFromMemory() {
    const value = await this.memoryStorageService.getBypassCache(this.metaData.sessionKey);
    await this.update(value);
  }

  async update(serializedValue: any) {
    const unBuiltValue = JSON.parse(serializedValue);
    if (!BrowserApi.isManifestVersion(3) && BrowserApi.isBackgroundPage(self)) {
      await this.memoryStorageService.save(this.metaData.sessionKey, serializedValue);
    }
    const builder = SyncedItemMetadata.builder(this.metaData);
    const value = builder(unBuiltValue);
    this.ignoreNUpdates = 1;
    this.subject.next(value);
  }

  private async updateSession(value: any) {
    const serializedValue = JSON.stringify(value);
    if (BrowserApi.isManifestVersion(3) || BrowserApi.isBackgroundPage(self)) {
      await this.memoryStorageService.save(this.metaData.sessionKey, serializedValue);
    }
    await BrowserApi.sendMessage(this.updateMessageCommand, { id: this.id, serializedValue });
  }

  private get updateMessageCommand() {
    return `${this.metaData.sessionKey}_update`;
  }
}
