import { concatMap, firstValueFrom, map, Observable, shareReplay, throwError } from "rxjs";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Rc } from "@bitwarden/common/platform/misc/reference-counting/rc";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { ManagedSettingsService } from "@bitwarden/managed-settings";
import { PasswordManagerClient, UnsignedSharedKey } from "@bitwarden/sdk-internal";

/**
 * Main process {@link SdkService} limited to the stateless client.
 *
 * The main process has no key, API or config services, so it cannot build user clients. Services
 * that only need stateless SDK operations (e.g. policy filtering) can still run here.
 *
 * The client is created without a token provider, device information or feature flags. Expand the
 * settings to match `DefaultSdkService` before using it for anything that makes requests.
 */
export class MainSdkService implements SdkService {
  client$: Observable<PasswordManagerClient> = this.environmentService.environment$.pipe(
    concatMap(async (env) => {
      await SdkLoadService.Ready;
      const managedSettings = await firstValueFrom(this.managedSettingsService.client$);

      // No token provider: the stateless client makes no authenticated requests.
      return await this.sdkClientFactory.createSdkClient(
        { get_access_token: async (): Promise<undefined> => undefined },
        { apiUrl: env.getApiUrl(), identityUrl: env.getIdentityUrl() },
        managedSettings,
      );
    }),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  version$ = this.client$.pipe(map((client) => client.version()));

  constructor(
    private sdkClientFactory: SdkClientFactory,
    private environmentService: EnvironmentService,
    private managedSettingsService: ManagedSettingsService,
  ) {}

  userClient$(userId: UserId): Observable<Rc<PasswordManagerClient>> {
    return throwError(() => unsupported());
  }

  async unlock(): Promise<Rc<PasswordManagerClient> | null> {
    throw unsupported();
  }

  async lock(userId: UserId): Promise<void> {
    throw unsupported();
  }

  logout(userId: UserId): void {
    throw unsupported();
  }

  async setFlags(userId: UserId, flags: Map<string, boolean>): Promise<void> {
    throw unsupported();
  }

  async setOrgKeys(
    userId: UserId,
    orgKeys: Record<OrganizationId, UnsignedSharedKey>,
  ): Promise<void> {
    throw unsupported();
  }
}

function unsupported(): Error {
  return new Error("User SDK clients are not available in the main process");
}
