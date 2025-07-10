import { ipcMain } from "electron";

/**
 * The ephemeral value store holds values that should be accessible to the renderer past a process reload.
 * In the current state, this store must not contain any keys that can decrypt a vault by themselves.
 */
export class EphemeralValueStorageService {
  private ephemeralValues = new Map<string, string>();

  constructor() {
    ipcMain.handle("setEphemeralValue", async (event, { key, value }) => {
      this.ephemeralValues.set(key, value);
    });
    ipcMain.handle("getEphemeralValue", async (event, key: string) => {
      return this.ephemeralValues.get(key);
    });
    ipcMain.handle("deleteEphemeralValue", async (event, key: string) => {
      this.ephemeralValues.delete(key);
    });
    ipcMain.handle("listEphemeralValueKeys", async (event) => {
      return Array.from(this.ephemeralValues.keys());
    });
  }
}
