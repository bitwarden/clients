// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
import { CommonModule } from "@angular/common";
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { filter, map, Subject } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitRowGroupComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  ChipActionComponent,
  CompactModeService,
  defineTable,
  IconButtonModule,
  IconComponent,
  NoItemsModule,
  ScrollLayoutService,
  SearchModule,
  TypographyModule,
} from "@bitwarden/components";
import { OrgIconDirective } from "@bitwarden/vault";

import BrowserPopupUtils from "../../../../../platform/browser/browser-popup-utils";
import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";
import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import {
  VaultPopupListTableService,
  VaultTableRow,
} from "../../../services/vault-popup-list-table.service";
import { VaultPopupLoadingService } from "../../../services/vault-popup-loading.service";
import { VaultPopupSectionService } from "../../../services/vault-popup-section.service";
import { PopupCipherViewLike } from "../../../views/popup-cipher.view";
import { ItemCopyActionsComponent } from "../item-copy-action/item-copy-actions.component";
import { ItemMoreOptionsComponent } from "../item-more-options/item-more-options.component";

@Component({
  selector: "app-vault-popup-list-table",
  templateUrl: "vault-popup-list-table.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Forward height through to the `height="fill"` table so it can size to a bounded parent
    // (e.g. the popup-page scroll area). Without this the host collapses to 0 and no rows show.
    //
    // The negative margins cancel `popup-page`'s scroll-region padding so the toolbar's bottom
    // border reaches the popup edges
    class:
      "tw-flex tw-flex-col tw-flex-1 tw-min-h-0 -tw-mx-3 bit-compact:-tw-mx-2 -tw-mt-3 bit-compact:-tw-mt-2",
  },
  imports: [
    CommonModule,
    FormsModule,
    JslibModule,
    BitTableV2Component,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitCellComponent,
    BitCellDefDirective,
    BitRowGroupComponent,
    BitTableToolbarComponent,
    IconButtonModule,
    IconComponent,
    NoItemsModule,
    SearchModule,
    TypographyModule,
    ChipActionComponent,
    ItemCopyActionsComponent,
    ItemMoreOptionsComponent,
    OrgIconDirective,
  ],
})
export class VaultPopupListTableComponent implements OnDestroy {
  private readonly vaultPopupLoadingService = inject(VaultPopupLoadingService);
  private readonly vaultPopupAutofillService = inject(VaultPopupAutofillService);
  private readonly vaultPopupSectionService = inject(VaultPopupSectionService);
  private readonly compactModeService = inject(CompactModeService);
  private readonly listTableService = inject(VaultPopupListTableService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly scrollLayout = inject(ScrollLayoutService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly i18nService = inject(I18nService);
  private readonly window = inject<Window>(WINDOW);

  /**
   * Whether the page content is scrolled, used to reveal the toolbar's bottom border.
   *
   * The table supplies the popup's search bar, so the separator between it and the list belongs to
   * the toolbar rather than to `popup-page`'s above-scroll-area, which is empty in this
   * presentation. Optional so the table still renders outside a `popup-page` (e.g. Storybook).
   */
  protected readonly pageScrolled =
    inject(PopupPageComponent, { optional: true })?.isScrolled ?? signal(false).asReadonly();

  protected readonly CipherViewLikeUtils = CipherViewLikeUtils;

  protected searchText: string = "";
  private readonly searchText$ = new Subject<string>();

  protected readonly loading = toSignal(this.vaultPopupLoadingService.loading$, {
    initialValue: true,
  });

  protected readonly rows = toSignal(this.listTableService.rows$, {
    initialValue: [] as VaultTableRow[],
  });

  protected readonly hasSearchText = toSignal(this.listTableService.hasSearchText$, {
    initialValue: false,
  });

  protected readonly table = defineTable<VaultTableRow, "name">(this.rows);

  protected readonly itemHeight = toSignal(
    this.compactModeService.enabled$.pipe(map((enabled) => (enabled ? 53 : 59))),
    { initialValue: 59 },
  );

  protected readonly currentUriIsBlocked = toSignal(
    this.vaultPopupAutofillService.currentTabIsOnBlocklist$,
  );

  /** Whether the popup is rendered in the sidebar, where the autofill refresh control is offered. */
  protected readonly showRefresh = BrowserPopupUtils.inSidebar(this.window);

  /** The viewport this component published, so repeat render passes can skip re-publishing. */
  private publishedScrollHost: ElementRef<HTMLElement> | null = null;

  /** The host `popup-page` had claimed, restored on teardown. */
  private displacedScrollHost: ElementRef<HTMLElement> | null = null;

  /**
   * Publishes the table's virtual-scroll viewport as the layout scroll host while mounted, so
   * scroll-position restore and the scrolled-state separator track the element that actually
   * scrolls — `popup-page`'s own region doesn't once the table fills it.
   *
   * Queried from the DOM because the viewport belongs to `bit-table-v2`'s template, so it is
   * neither this component's view nor its content.
   */
  private readonly _publishScrollHost = afterRenderEffect(() => {
    // Read as dependencies — the query below isn't reactive, and the viewport only exists once
    // these settle. Removing them stops the effect from ever finding it.
    this.loading();
    this.rows();

    // Compared against the service's value, not our own: the host gets re-claimed elsewhere.
    const current = this.scrollLayout.scrollableRef();
    const viewport = this.host.nativeElement.querySelector<HTMLElement>(
      "cdk-virtual-scroll-viewport",
    );

    // The viewport is destroyed whenever the table falls back to its loading or empty branch (e.g. a
    // search that matches nothing). Release the host rather than leaving a detached element
    // published, so `popup-page`'s own region takes back over until rows return.
    if (!viewport) {
      if (current === this.publishedScrollHost) {
        this.scrollLayout.scrollableRef.set(this.displacedScrollHost);
        this.publishedScrollHost = null;
      }
      return;
    }

    if (current?.nativeElement === viewport) {
      return;
    }

    this.displacedScrollHost ??= current;
    this.publishedScrollHost = new ElementRef(viewport);
    this.scrollLayout.scrollableRef.set(this.publishedScrollHost);
  });

  ngOnDestroy() {
    // Only yield the host back if nothing else has claimed it since.
    if (this.scrollLayout.scrollableRef() === this.publishedScrollHost) {
      this.scrollLayout.scrollableRef.set(this.displacedScrollHost);
    }
  }

  /** Keyboard-shortcut tooltip shown on the legacy (flag-off) autofill chip, e.g. "Autofill ⌘⇧L". */
  protected readonly autofillShortcutTooltip = signal<string | undefined>(undefined);

  /** The all-items section heading, which becomes "Search results" while a search is active. */
  protected readonly allItemsSectionKey = computed(() =>
    this.hasSearchText() ? "searchResults" : "allItems",
  );

  /** The autofill section heading, which becomes "Suggested items" when the current URI is blocked. */
  protected readonly autofillSectionKey = computed(() =>
    this.currentUriIsBlocked() ? "itemSuggestions" : "autofillSuggestions",
  );

  protected readonly favoritesOpenState = computed(
    () => this.vaultPopupSectionService.getOpenDisplayStateForSection("favorites")() ?? true,
  );

  protected readonly allItemsOpenState = computed(
    () => this.vaultPopupSectionService.getOpenDisplayStateForSection("allItems")() ?? true,
  );

  /** Persist a section's open/closed state when the user toggles its collapsible header. */
  protected setSectionCollapsed(section: "favorites" | "allItems", collapsed: boolean) {
    return this.vaultPopupSectionService.updateSectionOpenStoredState(section, !collapsed);
  }

  /**
   * Stable row identity for the table. The section prefix matters: the same cipher can appear in
   * both the autofill/favorites sections and all-items, so a bare `cipher.id` would collide.
   */
  protected readonly trackRow = (_: number, row: VaultTableRow) =>
    `${row._section}:${row.cipher.id}`;

  protected readonly isAutofill = (row: VaultTableRow) => row._section === "autofill";
  protected readonly isFavorites = (row: VaultTableRow) => row._section === "favorites";
  protected readonly isAllItems = (row: VaultTableRow) => row._section === "allItems";

  protected readonly isCard = (row: VaultTableRow) =>
    CipherViewLikeUtils.getType(row.cipher) === CipherType.Card;
  protected readonly isIdentity = (row: VaultTableRow) =>
    CipherViewLikeUtils.getType(row.cipher) === CipherType.Identity;

  constructor() {
    // Keep the input in sync with the search text already applied to the vault (e.g. restored state).
    this.listTableService.searchText$
      .pipe(
        takeUntilDestroyed(),
        filter((text) => !!text),
      )
      .subscribe((text) => (this.searchText = text));

    // Debounced apply lives in the service; the component just feeds it and owns the subscription.
    this.listTableService
      .applyFilterOnInput(this.searchText$)
      .pipe(takeUntilDestroyed())
      .subscribe();

    // Resolve the keyboard-shortcut tooltip for the legacy (flag-off) autofill chip.
    void this.setAutofillShortcutTooltip();
  }

  private async setAutofillShortcutTooltip() {
    const shortcut = await this.platformUtilsService.getAutofillKeyboardShortcut();
    this.autofillShortcutTooltip.set(
      shortcut === "" ? undefined : `${this.i18nService.t("autofillVerb")} ${shortcut}`,
    );
  }

  onSearchTextChanged() {
    this.searchText$.next(this.searchText);
  }

  /**
   * Primary click action for a row: autofill for autofill-section rows, otherwise navigate to view.
   */
  onCipherSelect(row: VaultTableRow) {
    return row.actions.primaryAutofill
      ? this.listTableService.doAutofill(row.cipher)
      : this.listTableService.viewCipher(row.cipher);
  }

  launchCipher(cipher: CipherViewLike) {
    return this.listTableService.launchCipher(cipher);
  }

  doAutofill(cipher: PopupCipherViewLike) {
    return this.listTableService.doAutofill(cipher);
  }

  /** Refreshes the current tab so the autofill suggestions repopulate. */
  refreshCurrentTab() {
    return this.listTableService.refreshCurrentTab();
  }

  orgIconTooltip({ collectionIds, collections }: PopupCipherViewLike) {
    if (collectionIds.length > 1 || !collections) {
      return this.i18nService.t("nSharedFolders", collectionIds.length);
    }
    return collections[0]?.name;
  }
}
