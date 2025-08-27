// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { SerializedMemoryStorageService } from "@bitwarden/storage-core";

import { BrowserApi } from "../browser/browser-api";

import { MemoryStoragePortMessage } from "./port-messages";
import { portName } from "./port-name";

export class BackgroundMemoryStorageService extends SerializedMemoryStorageService {
  private _ports: chrome.runtime.Port[] = [];

  constructor() {
    super();

    BrowserApi.addListener(chrome.runtime.onConnect, (port) => {
      if (port.name !== portName(chrome.storage.session)) {
        return;
      }

      this._ports.push(port);

      const listenerCallback = this.onMessageFromForeground.bind(this);
      port.onDisconnect.addListener(() => {
        this._ports.splice(this._ports.indexOf(port), 1);
        port.onMessage.removeListener(listenerCallback);
      });
      port.onMessage.addListener(listenerCallback);
      // Initialize the new memory storage service with existing data
      this.sendMessageTo(port, {
        action: "initialization",
        data: Array.from(Object.keys(this.store)),
      });
    });
    this.updates$.subscribe((update) => {
      this.broadcastMessage({
        action: "subject_update",
        data: update,
      });
    });
  }

  private async onMessageFromForeground(
    message: MemoryStoragePortMessage,
    port: chrome.runtime.Port,
  ) {
    if (message.originator === "background") {
      return;
    }

    let result: unknown = null;

    switch (message.action) {
      case "get":
      case "has": {
        result = await this[message.action](message.key);
        break;
      }
      case "save":
        await this.save(message.key, JSON.parse((message.data as string) ?? null) as unknown);
        break;
      case "remove":
        await this.remove(message.key);
        break;
    }

    this.sendMessageTo(port, {
      id: message.id,
      key: message.key,
      data: JSON.stringify(result),
    });
  }

  private broadcastMessage(data: Omit<MemoryStoragePortMessage, "originator">) {
    this._ports.forEach((port) => {
      this.sendMessageTo(port, data);
    });
  }

  private sendMessageTo(
    port: chrome.runtime.Port,
    data: Omit<MemoryStoragePortMessage, "originator">,
  ) {
    port.postMessage({
      ...data,
      originator: "background",
    });
  }
}
