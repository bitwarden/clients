import { ipcMain } from "electron";

import { UserKeyStateService } from "@bitwarden/common/key-management/user-key-state";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { UserKey } from "@bitwarden/common/types/key";
import { UserId } from "@bitwarden/user-core";

import { UserKeyStateAction, UserKeyStateMessage } from "./user-key-state-message";

export class MainUserKeyStateIpcListener {
  constructor(
    private userKeyStateService: UserKeyStateService,
    private logService: ConsoleLogService,
  ) {}

  init() {
    ipcMain.handle("userKeyState", async (_event: unknown, message: UserKeyStateMessage) => {
      try {
        switch (message.action) {
          case UserKeyStateAction.Get: {
            const key = await this.userKeyStateService.getUserKey(message.userId as UserId);
            return key?.toBase64() ?? null;
          }
          case UserKeyStateAction.Set: {
            const key =
              message.key == null ? null : (SymmetricCryptoKey.fromString(message.key) as UserKey);
            // Resolves only after the write completes, so the renderer's setUserKey
            // resolves once the key is observable in the main process.
            await this.userKeyStateService.setUserKey(message.userId as UserId, key);
            return;
          }
        }
      } catch (e) {
        // Never log message.key; it is key material.
        this.logService.error(
          "[Main UserKeyState IPC Listener] %s failed for user %s",
          message.action,
          message.userId,
        );
        throw e;
      }
    });
  }
}
