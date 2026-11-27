import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { filter, map, of, pairwise, switchMap, take } from "rxjs";

import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import { SecurityKeyIcon } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  PASSKEY_OPPORTUNITIES_IDLE,
  VaultHealthReportStatus,
} from "@bitwarden/common/dirt/vault-health/models";
import { PasskeyOpportunityService } from "@bitwarden/common/dirt/vault-health/services";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import {
  FilterOptionNode,
  StatusLockupComponent,
  SvgComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { PasswordRepromptService } from "@bitwarden/vault";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

import { HealthPasskeysListComponent } from "./components/health-passkeys-list/health-passkeys-list.component";
import { HealthScanErrorComponent } from "./components/health-scan-error/health-scan-error.component";
import { HealthPasskeyScanService } from "./services/health-passkey-scan.service";
import {
  buildPasskeyListRows,
  isFilteringPasskeys,
  matchesPasskeyFilters,
  PasskeyListFilters,
  PasskeyListRow,
} from "./services/passkey-list";
import {
  announceHealthListCount,
  focusHealthListRow,
  HEALTH_LIST_ROW_ATTRIBUTE,
  injectHealthListViewState,
  rememberHealthListScroll,
} from "./shared/health-list";

/** The list has one fixed sort, name A to Z, so the saved sort never changes. */
type PasskeySort = "name";

const EMPTY_TITLE_ID = "health-passkey-detail_empty-title";

/**
 * The "Passkeys available" page: logins whose sites support passkeys and that have none saved
 * yet, in the shared Health list (`bit-table-v2`), split into "Log in with a passkey" and
 * "Two-step login with a passkey". Opening a row views the item; "Set up" opens the site's
 * passkey instructions, or the site itself. Search, the Folder filter and the scroll offset
 * survive opening an item and coming back.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-health-passkey-detail",
  templateUrl: "./health-passkey-detail.component.html",
  imports: [
    CurrentAccountComponent,
    HealthPasskeysListComponent,
    HealthScanErrorComponent,
    I18nPipe,
    PopOutComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    StatusLockupComponent,
    SvgComponent,
    TypographyModule,
  ],
})
export class HealthPasskeyDetailComponent {
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly folderService = inject(FolderService);
  private readonly i18nService = inject(I18nService);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly passkeyOpportunityService = inject(PasskeyOpportunityService);
  private readonly healthPasskeyScanService = inject(HealthPasskeyScanService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly emptyIcon = SecurityKeyIcon;
  protected readonly emptyTitleId = EMPTY_TITLE_ID;

  private readonly viewState = injectHealthListViewState<PasskeyListFilters, PasskeySort>(
    "health-passkeys",
    { filters: {}, sort: "name" },
  );

  /** The row opened last, so focus can return to it when the user comes back. */
  private readonly openedRowId = inject(ViewCacheService).signal<string | null>({
    key: "health-passkeys-opened",
    initialValue: null,
    persistNavigation: true,
  });

  /** Read once: the table seeds its toolbar from it, and later edits come back as changes. */
  protected readonly filtersToRestore = this.viewState.filters();
  private readonly filters = signal<PasskeyListFilters>(this.viewState.filters());

  private readonly userId = toSignal(
    this.accountService.activeAccount$.pipe(map((account) => account?.id)),
  );

  private readonly state = toSignal(
    toObservable(this.userId).pipe(
      switchMap((userId) =>
        userId
          ? this.passkeyOpportunityService.getPasskeyOpportunities$(userId)
          : of(PASSKEY_OPPORTUNITIES_IDLE),
      ),
    ),
    { initialValue: PASSKEY_OPPORTUNITIES_IDLE },
  );

  private readonly ciphers = toSignal(
    toObservable(this.userId).pipe(
      filterOutNullish(),
      switchMap((userId) => this.cipherService.cipherViews$(userId)),
      filterOutNullish(),
      map((ciphers) => new Map(ciphers.map((cipher) => [cipher.id, cipher]))),
    ),
    { initialValue: new Map<string, CipherView>() },
  );

  private readonly folderNames = toSignal(
    toObservable(this.userId).pipe(
      filterOutNullish(),
      switchMap((userId) => this.folderService.folderViews$(userId)),
      map((folders) => new Map(folders.map((folder) => [folder.id, folder.name]))),
    ),
    { initialValue: new Map<string, string>() },
  );

  /** The last good result, kept on screen through a failed background refresh. */
  private readonly opportunities = computed(() => this.state().opportunities);

  protected readonly rows = computed(() =>
    buildPasskeyListRows(this.opportunities() ?? [], this.ciphers()),
  );

  /** No result yet: the first check is running or about to start. */
  protected readonly loading = computed(() => this.opportunities() == null && !this.failed());

  protected readonly failed = computed(
    () => this.state().status === VaultHealthReportStatus.Error && this.opportunities() == null,
  );

  protected readonly empty = computed(
    () => this.opportunities() != null && this.rows().length === 0,
  );

  /** Folders the listed logins are in, A to Z. */
  protected readonly folderOptions = computed<FilterOptionNode<string>[]>(() => {
    const names = this.folderNames();
    const ids = new Set(this.rows().map((row) => row.folderId));
    return [...ids]
      .filter((id): id is string => id != null && names.has(id))
      .map((id) => ({ value: id, label: names.get(id)! }))
      .sort((a, b) => this.i18nService.collator.compare(a.label, b.label));
  });

  /** The row focus was last in, to move focus on if that row leaves the list. */
  private readonly focusedRowId = signal<string | null>(null);

  constructor() {
    rememberHealthListScroll(
      this.viewState.scrollTop,
      computed(() => this.rows().length > 0),
    );

    // "3 results" while searching or filtering.
    announceHealthListCount(
      computed(() =>
        this.loading() || !isFilteringPasskeys(this.filters())
          ? undefined
          : this.rows().filter((row) => matchesPasskeyFilters(row, this.filters())).length,
      ),
      (count) => this.resultsMessage(count),
    );

    // "11 logins left" when the list changes for another reason, such as a passkey being saved.
    announceHealthListCount(
      computed(() => (this.loading() ? undefined : this.rows().length)),
      (count) =>
        count === 1
          ? this.i18nService.t("passkeyOpportunitiesRemainingSingular")
          : this.i18nService.t("passkeyOpportunitiesRemaining", count),
    );

    // Checks on arrival (the page can be opened directly or restored by the popup) and on
    // every vault change, so a login leaves the list once a passkey is saved to it.
    toObservable(this.userId)
      .pipe(
        filterOutNullish(),
        switchMap((userId) => this.healthPasskeyScanService.keepPasskeysCurrent$(userId)),
        takeUntilDestroyed(),
      )
      .subscribe();

    toObservable(computed(() => this.rows().length > 0))
      .pipe(filter(Boolean), take(1), takeUntilDestroyed())
      .subscribe(() => {
        const opened = this.openedRowId();
        if (opened != null) {
          this.openedRowId.set(null);
          this.focusAfterRender([opened]);
        }
      });

    toObservable(this.rows)
      .pipe(pairwise(), takeUntilDestroyed())
      .subscribe(([previous, current]) => this.moveFocusFromRemovedRow(previous, current));
  }

  protected onFocusIn(event: FocusEvent): void {
    const row = (event.target as HTMLElement | null)?.closest(`[${HEALTH_LIST_ROW_ATTRIBUTE}]`);
    this.focusedRowId.set(row?.getAttribute(HEALTH_LIST_ROW_ATTRIBUTE) ?? null);
  }

  protected onFiltersChange(filters: PasskeyListFilters): void {
    this.filters.set(filters);
    this.viewState.filters.set(filters);
  }

  protected readonly handleRetry = () => {
    const userId = this.userId();
    if (userId) {
      this.healthPasskeyScanService.retry(userId);
    }
  };

  /** Views the item, behind the master password reprompt like the other Health lists. */
  protected async openRow(row: PasskeyListRow): Promise<void> {
    if (!(await this.passwordRepromptService.passwordRepromptCheck(row.cipher))) {
      return;
    }
    this.openedRowId.set(row.id);
    await this.router.navigate(["/view-cipher"], {
      queryParams: { cipherId: row.cipher.id, type: row.cipher.type },
    });
  }

  /** Opens the site's passkey instructions, or the site; only http(s) links reach this. */
  protected setUp(row: PasskeyListRow): void {
    if (row.setUpUrl) {
      this.platformUtilsService.launchUri(row.setUpUrl);
    }
  }

  private resultsMessage(count: number): string {
    if (count === 0) {
      return this.i18nService.t("noItemsMatchSearch");
    }
    return count === 1
      ? this.i18nService.t("searchResultsCountSingular")
      : this.i18nService.t("searchResultsCount", count);
  }

  private moveFocusFromRemovedRow(previous: PasskeyListRow[], current: PasskeyListRow[]): void {
    const focused = this.focusedRowId();
    if (focused == null || current.some((row) => row.id === focused)) {
      return;
    }
    // Only when focus was still in the list (or dropped to the body with the removed row);
    // the user may have moved on.
    const document = this.host.nativeElement.ownerDocument;
    const active = document.activeElement;
    if (active != null && active !== document.body && !this.host.nativeElement.contains(active)) {
      return;
    }
    const remaining = new Set(current.map((row) => row.id));
    const index = previous.findIndex((row) => row.id === focused);
    const after = previous.slice(index + 1).find((row) => remaining.has(row.id));
    const before = previous
      .slice(0, Math.max(index, 0))
      .reverse()
      .find((row) => remaining.has(row.id));
    this.focusedRowId.set(null);
    this.focusAfterRender([after?.id, before?.id]);
  }

  private focusAfterRender(rowIds: (string | undefined)[]): void {
    afterNextRender(
      () =>
        setTimeout(() =>
          focusHealthListRow(this.host.nativeElement, rowIds, () =>
            this.host.nativeElement.querySelector<HTMLElement>(`#${EMPTY_TITLE_ID}`),
          ),
        ),
      { injector: this.injector },
    );
  }
}
