import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { UserAutoUnlockKeyService } from "@bitwarden/common/platform/services/user-auto-unlock-key.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { BiometricsStatus } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import { CliBiometricsService } from "../key-management/cli-biometrics-service";
import { Response } from "../models/response";
import { TemplateResponse } from "../models/response/template.response";

export class StatusCommand {
  constructor(
    private envService: EnvironmentService,
    private syncService: SyncService,
    private accountService: AccountService,
    private authService: AuthService,
    private userAutoUnlockKeyService: UserAutoUnlockKeyService,
    private biometricsService?: CliBiometricsService,
  ) {}

  async run(): Promise<Response> {
    try {
      const baseUrl = await this.baseUrl();
      const lastSync = await this.syncService.getLastSync();
      const [userId, email] = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => [a?.id, a?.email])),
      );
      const status = await this.status(userId);
      const biometricStatus = await this.biometricStatus(userId);

      return Response.success(
        new TemplateResponse({
          serverUrl: baseUrl,
          lastSync: lastSync,
          userEmail: email,
          userId: userId,
          status: status,
          biometricUnlock: biometricStatus,
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

  private async biometricStatus(
    userId: UserId | undefined,
  ): Promise<"available" | "unavailable" | "desktop_disconnected" | "not_configured" | undefined> {
    if (this.biometricsService == null) {
      return undefined;
    }

    try {
      // If we have a user, check their specific status, otherwise check general status
      const status =
        userId != null
          ? await this.biometricsService.getBiometricsStatusForUser(userId)
          : await this.biometricsService.getBiometricsStatus();

      return this.mapBiometricsStatus(status);
    } catch {
      return "desktop_disconnected";
    }
  }

  /**
   * Map BiometricsStatus enum to user-friendly CLI output strings.
   * Uses exhaustive switch to ensure new enum values are handled.
   */
  private mapBiometricsStatus(
    status: BiometricsStatus,
  ): "available" | "unavailable" | "desktop_disconnected" | "not_configured" | undefined {
    switch (status) {
      case BiometricsStatus.Available:
        return "available";

      case BiometricsStatus.DesktopDisconnected:
        return "desktop_disconnected";

      case BiometricsStatus.PlatformUnsupported:
        // Don't show biometric status on unsupported platforms
        return undefined;

      case BiometricsStatus.NotEnabledLocally:
      case BiometricsStatus.NotEnabledInConnectedDesktopApp:
      case BiometricsStatus.UnlockNeeded:
      case BiometricsStatus.AutoSetupNeeded:
      case BiometricsStatus.ManualSetupNeeded:
      case BiometricsStatus.NativeMessagingPermissionMissing:
        return "not_configured";

      case BiometricsStatus.HardwareUnavailable:
        return "unavailable";

      default: {
        // Exhaustive check: TypeScript will error if a new enum value is added
        const _exhaustiveCheck: never = status;
        throw new Error(`Unhandled BiometricsStatus value: ${_exhaustiveCheck}`);
      }
    }
  }
}
