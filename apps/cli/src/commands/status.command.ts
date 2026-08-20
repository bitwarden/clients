import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { UserAutoUnlockKeyService } from "@bitwarden/common/platform/services/user-auto-unlock-key.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { UserId } from "@bitwarden/user-core";

import { Response } from "../models/response";
import { TemplateResponse } from "../models/response/template.response";

export class StatusCommand {
  constructor(
    private envService: EnvironmentService,
    private syncService: SyncService,
    private accountService: AccountService,
    private authService: AuthService,
    private userAutoUnlockKeyService: UserAutoUnlockKeyService,
  ) {}

  async run(): Promise<Response> {
    try {
      const baseUrl = await this.baseUrl();
      const lastSync = await this.syncService.getLastSync();
      const [userId, email] = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => [a?.id, a?.email])),
      );
      const status = await this.status(userId);

      return Response.success(
        new TemplateResponse({
          serverUrl: baseUrl,
          lastSync: lastSync,
          userEmail: email,
          userId: userId,
          status: status,
        }),
      );
    } catch (e) {
      return Response.error(e);
    }
  }

  private async baseUrl(): Promise<string | undefined> {
    const env = await firstValueFrom(this.envService.environment$);
    return env.getUrls().base;
  }

  private async status(
    userId: UserId | undefined,
  ): Promise<"unauthenticated" | "locked" | "unlocked"> {
    if (userId != null) {
      await this.userAutoUnlockKeyService.setUserKeyInMemoryIfAutoUserKeySet(userId);
    }

    const authStatus = await this.authService.getAuthStatus();
    if (authStatus === AuthenticationStatus.Unlocked) {
      return "unlocked";
    } else if (authStatus === AuthenticationStatus.Locked) {
      return "locked";
    } else {
      return "unauthenticated";
    }
  }
}
