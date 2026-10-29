import { concatMap, firstValueFrom, map, Observable, shareReplay } from "rxjs";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
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
 */
export class MainSdkService implements SdkService {
  client$: Observable<PasswordManagerClient> = this.environmentService.environment$.pipe(
    concatMap(async (env) => {
      await SdkLoadService.Ready;
      const managedSettings = await firstValueFrom(this.managedSettingsService.client$);

      // No token provider: the stateless client makes no authenticated requests.
      return new PasswordManagerClient(
        { get_access_token: async (): Promise<undefined> => undefined },
        { apiUrl: env.getApiUrl(), identityUrl: env.getIdentityUrl() },
        managedSettings,
      );
    }),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  version$ = this.client$.pipe(map((client) => client.version()));

  constructor(
    private environmentService: EnvironmentService,
    private managedSettingsService: ManagedSettingsService,
  ) {}

  userClient$(_userId: UserId): Observable<Rc<PasswordManagerClient>> {
    throw unsupported();
  }

  unlock(): Promise<Rc<PasswordManagerClient> | null> {
    throw unsupported();
  }

  lock(_userId: UserId): Promise<void> {
    throw unsupported();
  }

  logout(_userId: UserId): void {
    throw unsupported();
  }

  setFlags(_userId: UserId, _flags: Map<string, boolean>): Promise<void> {
    throw unsupported();
  }

  setOrgKeys(_userId: UserId, _orgKeys: Record<OrganizationId, UnsignedSharedKey>): Promise<void> {
    throw unsupported();
  }
}

function unsupported(): Error {
  return new Error("User SDK clients are not available in the main process");
}
