import { inject, Injectable, NgZone } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  debounce,
  distinctUntilChanged,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  startWith,
  switchMap,
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
import { CipherType } from "@bitwarden/common/vault/enums";
import { SearchTextDebounceInterval } from "@bitwarden/common/vault/services/search.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogService } from "@bitwarden/components";
import {
  ALL_ITEMS_SCOPE,
  cipherInScope,
  DecryptionFailureDialogComponent,
  matchesFolder,
  matchesSharedFolder,
  matchesType,
  matchesVault,
  PasswordRepromptService,
  type VaultScope,
  VaultScopeType,
} from "@bitwarden/vault";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { PopupCipherViewLike } from "../views/popup-cipher.view";

import { VaultPopupAutofillService } from "./vault-popup-autofill.service";
import { VaultPopupItemsService } from "./vault-popup-items.service";
import { VaultPopupListTableFiltersService } from "./vault-popup-list-table-filters.service";
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
  private readonly listFiltersService = inject(VaultPopupListTableFiltersService);
  private readonly vaultSettingsService = inject(VaultSettingsService);

  /**
   * The vault the page's `:vaultId` route segment narrows to.
   */
  private readonly scope$ = new BehaviorSubject<VaultScope>(ALL_ITEMS_SCOPE);

  /** The scope currently narrowing the rows. Read by the table to gate its organization chip. */
  readonly vaultScope = toSignal(this.scope$, { initialValue: ALL_ITEMS_SCOPE });

  /**
   * Narrows the vault to `scope`; {@link ALL_ITEMS_SCOPE} shows every vault's items. Does not
   * clear the chips — this also fires on popup open, so the switcher does that instead.
   */
  setScope(scope: VaultScope | null): void {
    this.scope$.next(scope ?? ALL_ITEMS_SCOPE);
  }

  /**
   * Timeout used to add a small delay when selecting a cipher to allow for double click to launch.
   */
  private viewCipherTimeout?: number;

  /** The search text currently applied to the vault (e.g. restored from stored state). */
  readonly searchText$ = this.vaultPopupItemsService.searchText$;

  /** Whether a search term is currently narrowing the vault list. */
  readonly hasSearchText$ = this.vaultPopupItemsService.hasSearchText$;

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
    this.scope$,
  ]).pipe(
    map(([autoFillCiphers, favoriteCiphers, filteredCiphers, hasSearchText, context, scope]) => {
      /** One section's rows: the ciphers the scope admits, in display order. */
      const section = (ciphers: PopupCipherViewLike[], name: VaultSection) =>
        ciphers
          .filter((cipher) => cipherInScope(cipher, scope))
          .map((cipher) => this.toRow(cipher, name, context));

      if (hasSearchText) {
        return section(filteredCiphers, "allItems");
      }

      return [
        ...section(autoFillCiphers, "autofill"),
        ...section(favoriteCiphers, "favorites"),
        ...section(filteredCiphers, "allItems"),
      ];
    }),
    // The table renders these and the header counts them, so build the list once per emission.
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /**
   * Whether the vault in view is suspended, by route scope or by chip — only one is ever active.
   */
  readonly suspendedVault$: Observable<boolean> = combineLatest([
    this.scope$,
    this.listFiltersService.selectedFilters$,
  ]).pipe(
    switchMap(([scope, selected]) =>
      this.listFiltersService.suspended$(
        scope.type === VaultScopeType.Organization ? [scope.organizationId] : selected.organization,
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /**
   * The header's item count. Counts the `allItems` section, which holds every cipher once, and
   * re-applies the chips, which never reach {@link rows$}. A suspended vault counts zero.
   */
  readonly itemCount$: Observable<number> = combineLatest([
    this.rows$,
    this.listFiltersService.selectedFilters$,
    this.scope$,
    this.suspendedVault$,
  ]).pipe(
    map(([rows, selected, scope, suspended]) => {
      if (suspended) {
        return 0;
      }

      const filters = this.scopedFilters(selected, scope);

      return rows.filter(
        (row) =>
          row._section === "allItems" &&
          matchesType(row.cipher, filters.cipherType) &&
          matchesVault(row.cipher, filters.organization) &&
          matchesSharedFolder(row.cipher, filters.collection) &&
          matchesFolder(row.cipher, filters.folder),
      ).length;
    }),
  );

  /**
   * The chip selection, less what the scope has taken away — a scoped vault renders no vault chip.
   */
  private scopedFilters(
    selected: {
      cipherType: CipherType | null;
      organization: string[];
      collection: string[];
      folder: string[];
    },
    scope: VaultScope,
  ) {
    if (scope.type === VaultScopeType.AllItems) {
      return selected;
    }

    return { ...selected, organization: [] as string[] };
  }

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
