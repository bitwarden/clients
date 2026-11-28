import { ipcMain } from "electron";
import {
  combineLatest,
  distinctUntilChanged,
  firstValueFrom,
  map,
  of,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";

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

import { WindowMain } from "../../main/window.main";

import {
  UNLOCK_SESSIONS_CHANGED_CHANNEL,
  UnlockSessionsResponse,
  UnlockRequest,
  UnlockResponse,
  VaultState,
} from "./unlock-ipc.types";

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
    private readonly windowMain: WindowMain,
  ) {}

  private readonly destroy$ = new Subject<void>();

  init(): void {
    this.pushUnlockSessionsOnChange();

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

  dispose(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Tells the renderer the keys main holds, every time that set changes, so it never has to infer
   * them from lock, logout and unlock announcements. A destroyed renderer simply misses the push
   * and pulls the current set when it starts.
   */
  private pushUnlockSessionsOnChange(): void {
    this.accountService.accounts$
      .pipe(
        switchMap((accounts) => {
          const userIds = Object.keys(accounts) as UserId[];
          if (userIds.length === 0) {
            return of({} as Record<UserId, VaultState>);
          }

          return combineLatest(
            userIds.map((userId) =>
              this.keyService.userKey$(userId).pipe(map((key) => [userId, key] as const)),
            ),
          ).pipe(
            map((entries) =>
              Object.fromEntries(
                entries
                  .filter(([, key]) => key != null)
                  .map(([userId, key]) => [userId, { userKeyB64: key!.toBase64() }]),
              ),
            ),
          );
        }),
        distinctUntilChanged(
          (a, b) =>
            Object.keys(a).length === Object.keys(b).length &&
            Object.entries(a).every(
              ([userId, state]) => b[userId as UserId]?.userKeyB64 === state.userKeyB64,
            ),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (unlocked) =>
          this.windowMain.win?.webContents.send(UNLOCK_SESSIONS_CHANGED_CHANNEL, { unlocked }),
        error: (e: unknown) =>
          this.logService.error("[KeyManagementIpc] Unlock session pipeline stopped", e),
      });
  }
}
