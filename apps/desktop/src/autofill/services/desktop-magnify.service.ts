import { Injectable, OnDestroy } from "@angular/core";
import {
  combineLatest,
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
import { UserId } from "@bitwarden/user-core";

import {
  DEFAULT_CARD_EXPIRATION_FORMAT,
  MagnifyCommand,
  MagnifyCommandResponse,
} from "../models/magnify-commands";

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

  // Magnify is only active when the user has the setting enabled and the vault is unlocked
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

    this.magnifyFeatureEnabled$ = combineLatest([
      this.magnifyEnabledUserSetting$,
      this.authService.activeAccountStatus$,
    ]).pipe(
      map(
        ([settingEnabled, authStatus]) =>
          settingEnabled && authStatus === AuthenticationStatus.Unlocked,
      ),
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
        c.type === CipherType.Login &&
        !c.isDeleted &&
        !c.isArchived &&
        (c.name?.toLowerCase().includes(q) || c.login?.username?.toLowerCase().includes(q)),
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
      results: matched.map((c) => ({
        itemType: "login" as const,
        id: c.id,
        name: c.name,
        username: c.login?.username ?? "",
        iconUrl: buildCipherIcon(iconsUrl, c, showFavicons).image ?? null,
      })),
    };

    return [null, response];
  }

  /*
    This function returns the password for a specific Login cipher
    based on the copyPassword Magnify Command.

    Check the getAutotypeVaultData() fn in:
    apps/desktop/src/autofill/services/desktop-autotype.service.ts
    for examples of returning this Result type.

  */
  private async copyPassword(id: string): Promise<Result<MagnifyCommandResponse>> {
    const ciphers = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        map((account) => account?.id),
        filter((userId): userId is UserId => userId != null),
        switchMap((userId) => this.cipherService.cipherViews$(userId)),
      ),
    );

    const cipher = ciphers.find((c) => c.id === id);

    if (!cipher) {
      return [new Error(`Cipher with id ${id} not found.`), null];
    }

    const password = cipher.login?.password ?? "";
    const response: MagnifyCommandResponse = {
      type: MagnifyCommand.CopyPassword,
      result: password,
    };

    return [null, response];
  }

  /*
    Returns the card number for a specific Card vault item
    based on the copyCardNumber Magnify Command.
  */
  private async copyCardNumber(_itemId: string): Promise<Result<MagnifyCommandResponse>> {
    // Returning dummy data for now
    // TODO: IMPLEMENT ACTUAL COPY CARD NUMBER LOGIC HERE
    const response: MagnifyCommandResponse = {
      type: MagnifyCommand.CopyCardNumber,
      result: "4111111111111111",
    };

    return [null, response];
  }

  /*
    This function returns the expiration date for a specific Card vault item
    based on the copyCardExpiration Magnify Command.
    The format parameter controls the output format (e.g. "MM/YYYY").
  */
  private async copyCardExpiration(
    _itemId: string,
    _format: string,
  ): Promise<Result<MagnifyCommandResponse>> {
    // Returning dummy data for now
    // TODO: IMPLEMENT ACTUAL COPY CARD EXPIRATION LOGIC HERE
    // Use format param with itemId.card?.expMonth + itemId.card?.expYear
    const response: MagnifyCommandResponse = {
      type: MagnifyCommand.CopyCardExpiration,
      result: "12/2026",
    };

    return [null, response];
  }

  /*
    This function returns the CVV/security code for a specific Card vault item
    based on the copyCardCode Magnify Command.
  */
  private async copyCardCode(_itemId: string): Promise<Result<MagnifyCommandResponse>> {
    // Returning dummy data for now
    // TODO: IMPLEMENT ACTUAL COPY CARD CODE (CVV) LOGIC HERE
    const response: MagnifyCommandResponse = {
      type: MagnifyCommand.CopyCardCode,
      result: "123",
    };

    return [null, response];
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
