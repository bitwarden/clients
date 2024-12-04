import { ipcMain } from "electron";

import { epheremal_values } from "@bitwarden/desktop-napi";

/**
 * The ephemeral value store holds values that should be accessible to the renderer past a process reload.
 * In the current state, this store must not contain any keys that can decrypt a vault by themselves.
 */
export class EphemeralValueStorageService {
  constructor() {
    const ephemeralValues = new epheremal_values.EpheremalValueStoreWrapper();
    ipcMain.handle("setEphemeralValue", async (event, { key, value }) => {
      ephemeralValues.set(key, value);
    });
    ipcMain.handle("getEphemeralValue", async (event, key: string) => {
      return ephemeralValues.get(key);
    });
    ipcMain.handle("deleteEphemeralValue", async (event, key: string) => {
      ephemeralValues.remove(key);
    });
  }
}
