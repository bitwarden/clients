import * as fs from "fs";

import ElectronStore from "electron-store";

import { NodeUtils } from "@bitwarden/node/node-utils";

import { isWindowsPortable } from "../../../utils";

import { StorageBackend } from "./storage-backend";

// ElectronStore extends Conf which exposes a `.store` getter/setter, but
// `conf` uses package.json "exports" with no "types" fallback. Under
// moduleResolution: "node" the Conf types can't be resolved, so TypeScript
// doesn't see inherited members. This interface re-declares the property
// so strict type-checking passes.
interface ConfStore<T> {
  get store(): T;
  set store(value: T);
}

export class ElectronStoreBackend implements StorageBackend {
  private electronStore: ConfStore<Record<string, unknown>>;

  constructor(dir: string) {
    if (!fs.existsSync(dir)) {
      NodeUtils.mkdirpSync(dir, "700");
    }
    const fileMode = isWindowsPortable() ? 0o666 : 0o600;
    this.electronStore = new ElectronStore({
      defaults: {},
      name: "data",
      configFileMode: fileMode,
    }) as unknown as ConfStore<Record<string, unknown>>;
  }

  read(): Record<string, unknown> {
    return { ...this.electronStore.store };
  }

  update(updater: (store: Record<string, unknown>) => Record<string, unknown>): void {
    this.electronStore.store = updater({ ...this.electronStore.store });
  }

  flush(): void {
    // Writes are synchronous in electron-store, nothing to flush.
  }
}
