// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ipcMain } from "electron";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordUnlockData } from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { MASTER_PASSWORD_UNLOCK_DATA } from "@bitwarden/common/key-management/state-definitions";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { EncString } from "@bitwarden/sdk-internal";
import { StateProvider } from "@bitwarden/state";
import { UnlockMethod, UnlockService } from "@bitwarden/unlock";
import { UserId } from "@bitwarden/user-core";

import { UnlockSessionsResponse, UnlockRequest, UnlockResponse } from "./unlock-ipc.types";

/**
 * The main-process IPC surface the renderer uses to request a seed and to unlock. Main is the
 * session owner, so all unlock operations run here and the renderer only receives the resulting key.
 */
export class MainKeyManagementIpcListener {
  constructor(
    private readonly unlockService: UnlockService,
    private readonly keyService: KeyService,
    private readonly accountService: AccountService,
    private readonly stateProvider: StateProvider,
    private readonly logService: LogService,
  ) {}

  init(): void {
    ipcMain.handle("keyManagement.getUnlockSessions", async (): Promise<UnlockSessionsResponse> => {
      const accounts = await firstValueFrom(this.accountService.accounts$);
      const unlocked: UnlockSessionsResponse["unlocked"] = {};

      for (const userId of Object.keys(accounts) as UserId[]) {
        const userKey = await firstValueFrom(this.keyService.userKey$(userId));
        if (userKey != null) {
          unlocked[userId] = { userKeyB64: userKey.toBase64() };
        }
      }

      return { unlocked };
    });

    ipcMain.handle(
      "keyManagement.unlock",
      async (_event, request: UnlockRequest): Promise<UnlockResponse> => {
        switch (request.method) {
          case UnlockMethod.Pin:
            await this.unlockService.unlockWithPin(request.userId, request.pin);
            break;
          case UnlockMethod.MasterPassword:
            // The renderer just derived this during login; seed it into main's state so main's
            // unlock can find the master-password unlock data.
            if (request.masterPasswordUnlockData != null) {
              const unlockData = MasterPasswordUnlockData.fromJSON(
                JSON.parse(request.masterPasswordUnlockData),
              );
              if (unlockData != null) {
                await this.stateProvider.setUserState(
                  MASTER_PASSWORD_UNLOCK_DATA,
                  unlockData,
                  request.userId,
                );
              }
            }
            await this.unlockService.unlockWithMasterPassword(request.userId, request.password);
            break;
          case UnlockMethod.Biometrics:
            await this.unlockService.unlockWithBiometrics(request.userId);
            break;
          case UnlockMethod.KeyConnector:
            await this.unlockService.unlockWithKeyConnector(request.userId, {
              url: request.url,
              keyConnectorKeyWrappedUserKey: request.keyConnectorKeyWrappedUserKey as EncString,
            });
            break;
          case UnlockMethod.DecryptedUserKey:
            await this.unlockService.unlockWithDecryptedUserKey(
              request.userId,
              SymmetricCryptoKey.fromString(request.userKeyB64),
              request.unlockMethod,
            );
            break;
          case UnlockMethod.AutoKey:
            if (!(await this.unlockService.unlockWithAutoUnlockKey(request.userId))) {
              return { userKeyB64: null };
            }
            break;
          default:
            this.logService.error("[KeyManagementIpc] Unsupported unlock method", request);
            throw new Error("Unsupported unlock method");
        }

        const userKey = await firstValueFrom(this.keyService.userKey$(request.userId));
        return { userKeyB64: userKey?.toBase64() ?? null };
      },
    );
  }
}
