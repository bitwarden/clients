import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  input,
  output,
  Signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop";
import { filter, skip, switchMap } from "rxjs";

import { IconComponent as AppVaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitRowGroupComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  ButtonModule,
  CollapseOnScrollDirective,
  defineTable,
  FilterMenuModule,
  FilterOptionNode,
  LinkModule,
  ScrollCollapseSourceDirective,
  SearchModule,
  SortState,
  StatusLockupComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  matchesPasskeyFilters,
  passkeyComparator,
  PasskeyGroup,
  PasskeyListFilters,
  PasskeyListRow,
} from "../../services/passkey-list";
import {
  HEALTH_LIST_HOST_CLASS,
  HEALTH_LIST_ROW_ATTRIBUTE,
  injectHealthListRowHeight,
} from "../../shared/health-list";

/**
 * The passkey opportunities as a `bit-table-v2` list: virtual
 * two-line rows at the vault's height, a toolbar with search and a Folder chip that collapses on
 * scroll, and two row groups that say what each site supports, so rows carry no badges. Sorted
 * by name A to Z with no sort control.
 *
 * The page owns the data and the saved view state; this renders it and reports what happens.
 */
@Component({
  selector: "dirt-health-passkeys-list",
  templateUrl: "./health-passkeys-list.component.html",
  host: { class: HEALTH_LIST_HOST_CLASS },
  imports: [
    AppVaultIconComponent,
    BitCellComponent,
    BitCellDefDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitRowGroupComponent,
    BitTableToolbarComponent,
    BitTableV2Component,
    ButtonModule,
    CollapseOnScrollDirective,
    FilterMenuModule,
    I18nPipe,
    LinkModule,
    ScrollCollapseSourceDirective,
    SearchModule,
    StatusLockupComponent,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthPasskeysListComponent {
  private readonly i18nService = inject(I18nService);
  private readonly injector = inject(Injector);

  readonly rows = input.required<readonly PasskeyListRow[]>();
  readonly loading = input(false);
  /** Saved filter values to seed the toolbar with, once. */
  readonly filtersToRestore = input<Partial<PasskeyListFilters>>();
  /** Folders the listed logins are in, for the Folder chip. Hidden when empty. */
  readonly folderOptions = input<FilterOptionNode<string>[]>([]);

  readonly filtersChange = output<PasskeyListFilters>();
  /** A row was opened. */
  readonly open = output<PasskeyListRow>();
  /** A row's "Set up" was pressed. */
  readonly setUp = output<PasskeyListRow>();

  private readonly tableEl = viewChild(BitTableV2Component);

  protected readonly rowAttribute = HEALTH_LIST_ROW_ATTRIBUTE;
  protected readonly rowHeight = injectHealthListRowHeight(2);

  protected readonly table = defineTable<PasskeyListRow, "name">(computed(() => [...this.rows()]));

  protected readonly filterPredicate = matchesPasskeyFilters;

  protected readonly sortState = computed<SortState<"name">>(() => {
    const compare = passkeyComparator(this.i18nService.collator);
    return {
      column: "name",
      direction: "asc",
      fn: (a: unknown, b: unknown) => compare(a as PasskeyListRow, b as PasskeyListRow),
    };
  });

  protected readonly isLogin = (row: PasskeyListRow) => row.group === PasskeyGroup.Login;
  protected readonly isTwoStep = (row: PasskeyListRow) => row.group === PasskeyGroup.TwoStep;

  protected readonly trackRow = (_: number, row: PasskeyListRow) => row.id;

  constructor() {
    // Reports the toolbar's values so the page can save them and announce results.
    // Skips the empty values the table reports before the saved ones are seeded.
    toObservable(this.tableEl)
      .pipe(
        filter((table) => table != null),
        switchMap((table) =>
          // The view child is untyped, so the table's filter shape is restated here.
          toObservable(table.filterValues as unknown as Signal<PasskeyListFilters>, {
            injector: this.injector,
          }),
        ),
        skip(1),
        takeUntilDestroyed(),
      )
      .subscribe((values) => this.filtersChange.emit(values));
  }

  /** Clears the search and the Folder chip: the "no matches" state's way out. */
  protected clearFilters(): void {
    for (const control of this.tableEl()?.filterControls() ?? []) {
      control.setValue(undefined);
    }
  }
}
