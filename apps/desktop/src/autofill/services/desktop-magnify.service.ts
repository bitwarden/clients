import { Injectable, OnDestroy } from "@angular/core";
import {
  concatMap,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  Observable,
  of,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import {
  ActiveUserStateProvider,
  MAGNIFY_SETTINGS_DISK,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { buildCipherIcon } from "@bitwarden/common/vault/icon/build-cipher-icon";
import type { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { UserId } from "@bitwarden/user-core";

import {
  DEFAULT_CARD_EXPIRATION_FORMAT,
  MagnifyAuthStatus,
  MagnifyCommand,
  MagnifyCommandResponse,
  MagnifyErrorCode,
} from "../models/magnify-commands";
import { MagnifyItem } from "../models/magnify-items";

import { MagnifyNavigationService } from "./magnify-navigation.service";

export const MAGNIFY_ENABLED = new UserKeyDefinition<boolean | null>(
  MAGNIFY_SETTINGS_DISK,
  "magnifyEnabled",
  {
    deserializer: (value: boolean | null) => !!value,
    clearOn: [],
  },
);

export type Result<T, E = Error> = [E, null] | [null, T];

@Injectable({
  providedIn: "root",
})
export class DesktopMagnifyService implements OnDestroy {
  private readonly magnifyEnabledState = this.activeUserStateProvider.get(MAGNIFY_ENABLED);

  // The enabled/disabled state from the user settings menu
  magnifyEnabledUserSetting$: Observable<boolean> = of(false);

  // Magnify is active whenever the user has the setting enabled — auth state
  // is checked at the command level so the UI can show a locked/logged-out message.
  private magnifyFeatureEnabled$: Observable<boolean> = of(false);

  private destroy$ = new Subject<void>();

  constructor(
    private activeUserStateProvider: ActiveUserStateProvider,
    private authService: AuthService,
    private accountService: AccountService,
    private cipherService: CipherService,
    private environmentService: EnvironmentService,
    private domainSettingsService: DomainSettingsService,
    private magnifyNavigationService: MagnifyNavigationService,
  ) {
    this.magnifyEnabledUserSetting$ = this.magnifyEnabledState.state$.pipe(
      map((enabled) => enabled ?? false),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    );

    this.magnifyFeatureEnabled$ = this.magnifyEnabledUserSetting$.pipe(
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    );
  }

  async init() {
    this.magnifyFeatureEnabled$
      .pipe(
        concatMap(async (enabled) => {
          ipc.autofill.toggleMagnify(enabled);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    ipc.autofill.listenMagnifyCommand(async (request, callback) => {
      const authStatus = await firstValueFrom(this.authService.activeAccountStatus$);

      // GetAuthStatus always returns a successful response regardless of auth state
      if (request.type === MagnifyCommand.GetAuthStatus) {
        let status: MagnifyAuthStatus;
        if (authStatus === AuthenticationStatus.LoggedOut) {
          status = MagnifyAuthStatus.LoggedOut;
        } else if (authStatus === AuthenticationStatus.Locked) {
          status = MagnifyAuthStatus.Locked;
        } else {
          status = MagnifyAuthStatus.Unlocked;
        }
        callback(null, { type: MagnifyCommand.GetAuthStatus, status });
        return;
      }

      // All other commands require an unlocked vault
      if (authStatus === AuthenticationStatus.LoggedOut) {
        callback(new Error(MagnifyErrorCode.LoggedOut), null);
        return;
      }

      if (authStatus === AuthenticationStatus.Locked) {
        callback(new Error(MagnifyErrorCode.VaultLocked), null);
        return;
      }

      switch (request.type) {
        case MagnifyCommand.SearchVault: {
          const [error, result] = await this.searchVault(request.input);
          callback(error, result);
          break;
        }

        case MagnifyCommand.CopyPassword: {
          const [error, result] = await this.copyPassword(request.itemId);
          callback(error, result);
          break;
        }

        case MagnifyCommand.ViewInBitwarden: {
          const [error, result] = await this.viewInBitwarden(request.itemId);
          callback(error, result);
          break;
        }

        case MagnifyCommand.CopyCardNumber: {
          const [error, result] = await this.copyCardNumber(request.itemId);
          callback(error, result);
          break;
        }

        case MagnifyCommand.CopyCardExpiration: {
          const [error, result] = await this.copyCardExpiration(
            request.itemId,
            request.format ?? DEFAULT_CARD_EXPIRATION_FORMAT,
          );
          callback(error, result);
          break;
        }

        case MagnifyCommand.CopyCardCode: {
          const [error, result] = await this.copyCardCode(request.itemId);
          callback(error, result);
          break;
        }
      }
    });
  }

  async setMagnifyEnabledState(enabled: boolean): Promise<void> {
    await this.magnifyEnabledState.update(() => enabled, {
      shouldUpdate: (currentlyEnabled) => currentlyEnabled !== enabled,
    });
  }

  /*
    This function searches the vault using an input string
    and returns the relevant MagnifyCommandResponse. This is based
    on the searchVault Magnify Command.

    Check the getAutotypeVaultData() fn in:
    apps/desktop/src/autofill/services/desktop-autotype.service.ts
    for examples of returning this Result type.
  */
  private async searchVault(input: string): Promise<Result<MagnifyCommandResponse>> {
    const q = input.trim().toLowerCase();

    const ciphers = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        map((account) => account?.id),
        filter((userId): userId is UserId => userId != null),
        switchMap((userId) => this.cipherService.cipherViews$(userId)),
      ),
    );

    const matched = ciphers.filter(
      (c) =>
        (c.type === CipherType.Login || c.type === CipherType.Card) &&
        !c.isDeleted &&
        !c.isArchived &&
        (c.name?.toLowerCase().includes(q) ||
          (c.type === CipherType.Login && c.login?.username?.toLowerCase().includes(q))),
    );

    matched.sort((a, b) => {
      const aStarts = a.name?.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.name?.toLowerCase().startsWith(q) ? 0 : 1;
      return aStarts - bStarts;
    });

    const env = await firstValueFrom(this.environmentService.environment$);
    const iconsUrl = env.getIconsUrl();
    const showFavicons = await firstValueFrom(this.domainSettingsService.showFavicons$);

    const response: MagnifyCommandResponse = {
      type: MagnifyCommand.SearchVault,
      results: matched.map((c) => {
        if (c.type === CipherType.Card) {
          return {
            itemType: MagnifyItem.Card,
            id: c.id,
            name: c.name,
            brand: c.card?.brand ?? undefined,
          };
        }
        return {
          itemType: MagnifyItem.Login,
          id: c.id,
          name: c.name,
          username: c.login?.username ?? "",
          iconUrl: buildCipherIcon(iconsUrl, c, showFavicons).image ?? null,
        };
      }),
    };

    return [null, response];
  }

  private async findCipher(itemId: string): Promise<Result<CipherView>> {
    const ciphers = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        map((account) => account?.id),
        filter((userId): userId is UserId => userId != null),
        switchMap((userId) => this.cipherService.cipherViews$(userId)),
      ),
    );

    const cipher = ciphers.find((c) => c.id === itemId && c.deletedDate == null);

    if (!cipher) {
      return [new Error(`Cipher with id ${itemId} not found.`), null];
    }

    return [null, cipher];
  }

  /*
    This function returns the password for a specific Login cipher
    based on the copyPassword Magnify Command.

    Check the getAutotypeVaultData() fn in:
    apps/desktop/src/autofill/services/desktop-autotype.service.ts
    for examples of returning this Result type.

  */
  private async copyPassword(id: string): Promise<Result<MagnifyCommandResponse>> {
    const [error, cipher] = await this.findCipher(id);
    if (error) {
      return [error, null];
    }

    return [null, { type: MagnifyCommand.CopyPassword, result: cipher.login?.password ?? "" }];
  }

  /*
    Returns the card number for a specific Card vault item
    based on the copyCardNumber Magnify Command.
  */
  private async copyCardNumber(itemId: string): Promise<Result<MagnifyCommandResponse>> {
    const [error, cipher] = await this.findCipher(itemId);
    if (error) {
      return [error, null];
    }

    return [null, { type: MagnifyCommand.CopyCardNumber, result: cipher.card?.number ?? "" }];
  }

  /*
    Returns the expiration date for a specific Card vault item
    based on the copyCardExpiration Magnify Command.
    The format parameter controls the output format, where "MM" is replaced
    with the zero-padded month and "YYYY" with the four-digit year.
  */
  private async copyCardExpiration(
    itemId: string,
    format: string,
  ): Promise<Result<MagnifyCommandResponse>> {
    const [error, cipher] = await this.findCipher(itemId);
    if (error) {
      return [error, null];
    }

    const month = (cipher.card?.expMonth ?? "").padStart(2, "0");
    const year = cipher.card?.expYear ?? "";
    return [
      null,
      {
        type: MagnifyCommand.CopyCardExpiration,
        result: format.replace("MM", month).replace("YYYY", year),
      },
    ];
  }

  /*
    Returns the CVV/security code for a specific Card vault item
    based on the copyCardCode Magnify Command.
  */
  private async copyCardCode(itemId: string): Promise<Result<MagnifyCommandResponse>> {
    const [error, cipher] = await this.findCipher(itemId);
    if (error) {
      return [error, null];
    }

    return [null, { type: MagnifyCommand.CopyCardCode, result: cipher.card?.code ?? "" }];
  }

  /*
    Navigates the app's vault view to show the specified Login item
    using the itemId query parameter.
  */
  private async viewInBitwarden(itemId: string): Promise<Result<MagnifyCommandResponse>> {
    this.magnifyNavigationService.requestViewInBitwarden(itemId);

    const response: MagnifyCommandResponse = { type: MagnifyCommand.ViewInBitwarden };
    return [null, response];
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
