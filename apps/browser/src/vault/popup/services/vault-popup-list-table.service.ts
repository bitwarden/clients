import { inject, Injectable, NgZone } from "@angular/core";
import { Router } from "@angular/router";
import {
  combineLatest,
  debounce,
  distinctUntilChanged,
  firstValueFrom,
  map,
  Observable,
  startWith,
  tap,
  timer,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { SearchTextDebounceInterval } from "@bitwarden/common/vault/services/search.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogService } from "@bitwarden/components";
import { DecryptionFailureDialogComponent, PasswordRepromptService } from "@bitwarden/vault";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { PopupCipherViewLike } from "../views/popup-cipher.view";

import { VaultPopupAutofillService } from "./vault-popup-autofill.service";
import { VaultPopupItemsService } from "./vault-popup-items.service";
import { VaultPopupLoadingService } from "./vault-popup-loading.service";

/** The section a row belongs to within the vault list table. */
export type VaultSection = "autofill" | "favorites" | "allItems";

/**
 * The resolved action affordances for a single row — which click action it takes and which
 * buttons/menu entries it exposes. Precomputed here so the template stays declarative and the
 * feature-flag/blocklist branching lives in one testable place.
 */
export interface VaultRowActions {
  /** Whether clicking the row autofills (vs. navigating to view). */
  primaryAutofill: boolean;
  /** Reveal the "Fill" text on hover — simplified (flag-on) design only. */
  showFillOnHover: boolean;
  /** Show the standalone primary "Fill" chip — legacy (flag-off) design only. */
  showAutofillBadge: boolean;
  /** Show the launch-in-new-tab button (still gated on the cipher being launchable). */
  showLaunch: boolean;
  /** Offer "Autofill" in the more-options menu. */
  showAutofillInMenu: boolean;
  /** Offer "View" in the more-options menu. */
  showViewInMenu: boolean;
  /** Resolved i18n key for the row's accessible title. */
  titleKey: string;
}

/** A cipher tagged with the section it renders under and its resolved actions; the row model. */
export type VaultTableRow = {
  cipher: PopupCipherViewLike;
  _section: VaultSection;
  actions: VaultRowActions;
};

/** Feature-flag, blocklist, and click-setting inputs that decide a row's action affordances. */
interface RowActionContext {
  simplifiedItemActionEnabled: boolean;
  currentUriIsBlocked: boolean;
  clickItemsToAutofillVaultView: boolean;
}

/**
 * Derives the ordered, section-tagged rows for the vault list table and encapsulates the primary
 * interactions a user can perform on a row (autofill, launch, and view). Kept independent of the
 * component so the section/search-branching behavior and item actions can be tested in isolation.
 */
@Injectable({
  providedIn: "root",
})
export class VaultPopupListTableService {
  private readonly vaultPopupItemsService = inject(VaultPopupItemsService);
  private readonly vaultPopupLoadingService = inject(VaultPopupLoadingService);
  private readonly ngZone = inject(NgZone);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);
  private readonly vaultPopupAutofillService = inject(VaultPopupAutofillService);
  private readonly configService = inject(ConfigService);
  private readonly vaultSettingsService = inject(VaultSettingsService);

  /**
   * Timeout used to add a small delay when selecting a cipher to allow for double click to launch.
   */
  private viewCipherTimeout?: number;

  /** The search text currently applied to the vault (e.g. restored from stored state). */
  readonly searchText$ = this.vaultPopupItemsService.searchText$;

  /** Whether a search term is currently narrowing the vault list. */
  readonly hasSearchText$ = this.vaultPopupItemsService.hasSearchText$;

  /**
   * Whether the account has any active items at all, ignoring search/filters — the account-wide
   * fact `EmptyVaultComponent` needs to distinguish "nothing here because of an active
   * search/filter" from "the vault is genuinely empty."
   */
  readonly hasItems$: Observable<boolean> = this.vaultPopupItemsService.emptyVault$.pipe(
    map((empty) => !empty),
  );

  /**
   * The inputs that decide each row's action affordances. `startWith` defaults keep {@link rows$}
   * emitting promptly: the feature flag and blocklist streams resolve asynchronously, so without a
   * seed the whole list would wait on them before first render.
   */
  private readonly rowActionContext$: Observable<RowActionContext> = combineLatest([
    this.configService
      .getFeatureFlag$(FeatureFlag.PM31039ItemActionInExtension)
      .pipe(startWith(false)),
    this.vaultPopupAutofillService.currentTabIsOnBlocklist$.pipe(startWith(false)),
    this.vaultSettingsService.clickItemsToAutofillVaultView$.pipe(startWith(true)),
  ]).pipe(
    map(([simplifiedItemActionEnabled, currentUriIsBlocked, clickItemsToAutofillVaultView]) => ({
      simplifiedItemActionEnabled,
      currentUriIsBlocked,
      clickItemsToAutofillVaultView: clickItemsToAutofillVaultView ?? true,
    })),
  );

  /**
   * The rows to render, in display order. When a search is active the list collapses to a single
   * flat "all items" section (mirroring the existing vault, which folds every filtered cipher into
   * one container); otherwise it splits into the autofill, favorites, and all-items sections.
   */
  readonly rows$: Observable<VaultTableRow[]> = combineLatest([
    this.vaultPopupItemsService.autoFillCiphers$,
    this.vaultPopupItemsService.favoriteCiphers$,
    this.vaultPopupItemsService.filteredCiphers$,
    this.vaultPopupItemsService.hasSearchText$,
    this.rowActionContext$,
  ]).pipe(
    map(([autoFillCiphers, favoriteCiphers, filteredCiphers, hasSearchText, context]) => {
      if (hasSearchText) {
        return filteredCiphers.map((cipher) => this.toRow(cipher, "allItems", context));
      }

      return [
        ...autoFillCiphers.map((cipher) => this.toRow(cipher, "autofill", context)),
        ...favoriteCiphers.map((cipher) => this.toRow(cipher, "favorites", context)),
        ...filteredCiphers.map((cipher) => this.toRow(cipher, "allItems", context)),
      ];
    }),
  );

  private toRow(
    cipher: PopupCipherViewLike,
    section: VaultSection,
    context: RowActionContext,
  ): VaultTableRow {
    return {
      cipher,
      _section: section,
      actions: this.resolveActions(cipher, section, context),
    };
  }

  /**
   * Resolves a row's action affordances from its section and the current context. Pure so the
   * feature-flag/blocklist branching can be exercised directly. The `simplifiedItemActionEnabled`
   * (flag-off) branch mirrors the pre-flag `vault-list-items-container` behavior and can be removed
   * once {@link FeatureFlag.PM31039ItemActionInExtension} is fully rolled out.
   */
  private resolveActions(
    cipher: PopupCipherViewLike,
    section: VaultSection,
    {
      simplifiedItemActionEnabled,
      currentUriIsBlocked,
      clickItemsToAutofillVaultView,
    }: RowActionContext,
  ): VaultRowActions {
    const isAutofill = section === "autofill";

    // Whether clicking the row autofills. Simplified: the autofill section fills unless the URI is
    // blocked. Legacy: the autofill section fills only when the user's click-to-autofill setting is
    // on, and never when the URI is blocked.
    const primaryAutofill = simplifiedItemActionEnabled
      ? isAutofill && !currentUriIsBlocked
      : !currentUriIsBlocked && isAutofill && clickItemsToAutofillVaultView;

    const login = CipherViewLikeUtils.getLogin(cipher as CipherViewLike);
    const titleBase = primaryAutofill ? "autofillTitle" : "viewItemTitle";

    return {
      primaryAutofill,
      showFillOnHover: simplifiedItemActionEnabled && primaryAutofill,
      // Legacy standalone chip: shown on autofill rows when click-to-autofill is off and not blocked.
      showAutofillBadge:
        !simplifiedItemActionEnabled &&
        isAutofill &&
        !currentUriIsBlocked &&
        !clickItemsToAutofillVaultView,
      showLaunch: !isAutofill,
      showAutofillInMenu: simplifiedItemActionEnabled
        ? !primaryAutofill
        : !currentUriIsBlocked && !isAutofill,
      showViewInMenu: primaryAutofill,
      // Name the login's username field in the label when it has one.
      titleKey: login?.username != null ? `${titleBase}WithField` : titleBase,
    };
  }

  /**
   * Applies debounced search input to the vault, mirroring the existing vault search behavior:
   * applied immediately while the vault is loading (to avoid stale results), otherwise debounced by
   * {@link SearchTextDebounceInterval}. Returns a stream the caller subscribes to (and tears down)
   * so the subscription stays tied to the consuming component's lifecycle.
   */
  applyFilterOnInput(searchText$: Observable<string>): Observable<string> {
    return combineLatest([searchText$, this.vaultPopupLoadingService.loading$]).pipe(
      debounce(([, isLoading]) => timer(isLoading ? 0 : SearchTextDebounceInterval)),
      distinctUntilChanged(
        ([prevText, prevLoading], [newText, newLoading]) =>
          prevText === newText && prevLoading === newLoading,
      ),
      map(([text]) => text),
      tap((text) =>
        this.ngZone.runOutsideAngular(() =>
          this.ngZone.run(() => this.vaultPopupItemsService.applyFilter(text)),
        ),
      ),
    );
  }

  /**
   * Refreshes the current tab so the autofill suggestions repopulate. Used by the sidebar, which
   * stays open across navigations and can otherwise show stale suggestions.
   */
  refreshCurrentTab() {
    this.vaultPopupAutofillService.refreshCurrentTab();
  }

  /**
   * Launches the login cipher in a new browser tab.
   */
  async launchCipher(cipher: CipherViewLike) {
    const launchURI = CipherViewLikeUtils.getLaunchUri(cipher);
    if (!CipherViewLikeUtils.canLaunch(cipher) || !launchURI) {
      return;
    }

    // If there is a view action pending, clear it
    if (this.viewCipherTimeout != null) {
      window.clearTimeout(this.viewCipherTimeout);
      this.viewCipherTimeout = undefined;
    }

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.updateLastLaunchedDate(uuidAsString(cipher.id!), activeUserId);

    await BrowserApi.createNewTab(launchURI);

    if (BrowserPopupUtils.inPopup(window)) {
      BrowserApi.closePopup(window);
    }
  }

  async doAutofill(cipher: PopupCipherViewLike) {
    if (!CipherViewLikeUtils.isCipherListView(cipher)) {
      await this.vaultPopupAutofillService.doAutofill(cipher);
      return;
    }

    // When only the `CipherListView` is available, fetch the full cipher details
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const cipherView = await firstValueFrom(
      this.cipherService.cipherView$(activeUserId, uuidAsString(cipher.id!) as CipherId),
    );

    if (!cipherView) {
      return;
    }

    await this.vaultPopupAutofillService.doAutofill(cipherView);
  }

  async viewCipher(cipher: PopupCipherViewLike) {
    // We already have a view action in progress, don't start another
    if (this.viewCipherTimeout != null) {
      return;
    }

    // Wrap in a timeout to allow for double click to launch
    this.viewCipherTimeout = window.setTimeout(
      async () => {
        try {
          if (CipherViewLikeUtils.decryptionFailure(cipher)) {
            DecryptionFailureDialogComponent.open(this.dialogService, {
              cipherIds: [cipher.id as CipherId],
            });
            return;
          }

          const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(cipher);
          if (!repromptPassed) {
            return;
          }
          await this.router.navigate(["/view-cipher"], {
            queryParams: { cipherId: cipher.id, type: cipher.type },
          });
        } finally {
          // Ensure the timeout is always cleared
          this.viewCipherTimeout = undefined;
        }
      },
      CipherViewLikeUtils.canLaunch(cipher) ? 200 : 0,
    );
  }
}
