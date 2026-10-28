import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  concatMap,
  firstValueFrom,
  from,
  lastValueFrom,
  map,
  Observable,
  switchMap,
} from "rxjs";
import { first } from "rxjs/operators";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  CollectionView,
  CollectionDetailsResponse,
  CollectionResponse,
  Collection,
  CollectionData,
} from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BadgeGroupComponent,
  type BadgeGroupItem,
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTablePaginatorComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  BulkActionComponent,
  BulkActionsBarComponent,
  defineTable,
  DialogService,
  FilterMenuModule,
  type FilterOptionNode,
  IconModule,
  MenuModule,
  SearchModule,
  type SelectionConfig,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { Vfo1I18nPipe, Vfo1IconPipe, Vfo1TerminologyService } from "@bitwarden/vault";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";
import { GroupDetailsView, InternalGroupApiService as GroupService } from "../core";

import {
  GroupAddEditDialogResultType,
  GroupAddEditTabType,
  openAddGroupDialog,
  openEditGroupDialog,
} from "./group-add-edit";

type GroupRow = {
  /** Details used for displaying group information. */
  details: GroupDetailsView;

  /** Collections (shared folders) the group has access to, as badges for display. */
  collectionBadges: BadgeGroupItem[];
};

type GroupFilters = {
  search?: string;
  /** Selected collection ids from the shared-folders filter. */
  collections?: string[];
};

@Component({
  selector: "app-groups-v2",
  templateUrl: "groups-v2.component.html",
  imports: [
    SharedModule,
    HeaderModule,
    IconModule,
    SearchModule,
    MenuModule,
    FilterMenuModule,
    BadgeGroupComponent,
    BitTableV2Component,
    BitColumnComponent,
    BitCellDefDirective,
    BitHeaderCellComponent,
    BitCellComponent,
    BitTableToolbarComponent,
    BitTablePaginatorComponent,
    BulkActionsBarComponent,
    BulkActionComponent,
    Vfo1IconPipe,
    Vfo1I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupsV2Component {
  private readonly apiService = inject(ApiService);
  private readonly groupService = inject(GroupService);
  private readonly route = inject(ActivatedRoute);
  private readonly i18nService = inject(I18nService);
  private readonly dialogService = inject(DialogService);
  private readonly collectionService = inject(CollectionService);
  private readonly accountService = inject(AccountService);
  private readonly keyService = inject(KeyService);
  private readonly vfo1Terminology = inject(Vfo1TerminologyService);

  protected readonly loading = signal(true);
  protected readonly searchControl = new FormControl("");

  protected readonly ModalTabType = GroupAddEditTabType;
  private readonly refreshGroups$ = new BehaviorSubject<void>(undefined);

  private readonly rows = signal<GroupRow[]>([]);
  protected readonly table = defineTable<GroupRow, "actions">(this.rows);

  /** Enables the selection column and bit-bulk-actions-bar. Delete is stubbed here; the real
   * confirm/delete/toast flow lands in a follow-up ticket. */
  protected readonly selection: SelectionConfig<GroupRow> = { multiple: true };

  /** Data-driven tree for the shared-folders filter — one top-level node per collection. */
  protected readonly collectionFilterOptions = signal<FilterOptionNode<string>[]>([]);

  /** Seeds the table's search chip from `?search=` on first load; the table reads the live
   * value from the projected bit-search itself afterward. */
  protected readonly initialFilters: Partial<GroupFilters> = {
    search: this.route.snapshot.queryParams.search ?? "",
  };

  private readonly organizationId$ = this.route.params.pipe(map((params) => params.organizationId));

  constructor() {
    this.organizationId$
      .pipe(
        switchMap((organizationId) => {
          return combineLatest([
            // collectionMap
            from(this.apiService.getCollections(organizationId)).pipe(
              concatMap((response) => this.toCollectionMap(response)),
            ),
            // groups
            this.refreshGroups$.pipe(
              switchMap(() => this.groupService.getAllDetails(organizationId)),
            ),
          ]);
        }),
        map(([collectionMap, groups]) => {
          const sharedFolderIcon = this.vfo1Terminology.iconClass("bwi-collection-shared");
          const rows = groups.map<GroupRow>((g) => ({
            details: g,
            collectionBadges: g.collections
              .map((c) => collectionMap[c.id]?.name)
              .filter((name): name is string => name != null)
              .sort(this.i18nService.collator?.compare)
              .map((label): BadgeGroupItem => ({
                label,
                variant: "primary",
                startIcon: sharedFolderIcon,
              })),
          }));

          const filterOptions: FilterOptionNode<string>[] = Object.values(collectionMap)
            .sort((a, b) => this.i18nService.collator?.compare(a.name, b.name) ?? 0)
            .map((collection) => ({
              value: collection.id,
              label: collection.name,
              count: rows.filter((r) => r.details.collections.some((c) => c.id === collection.id))
                .length,
            }));

          return { rows, filterOptions };
        }),
        takeUntilDestroyed(),
      )
      .subscribe(({ rows, filterOptions }) => {
        this.rows.set(rows);
        this.collectionFilterOptions.set(filterOptions);
        this.loading.set(false);
      });

    this.route.queryParams.pipe(first(), takeUntilDestroyed()).subscribe((qParams) => {
      this.searchControl.setValue(qParams.search);
    });
  }

  /**
   * Row test given the table's {@link filterValues}: matches search by id/name only (not member
   * or collection names, which can unintentionally collide), and, when one or more collections
   * are selected in the shared-folders filter, requires the row to have access to at least one.
   */
  protected readonly filterGroups = (row: GroupRow, filters: GroupFilters): boolean => {
    const search = (filters.search ?? "").trim().toLowerCase();
    const matchesSearch =
      search === "" ||
      row.details.id.toLowerCase().includes(search) ||
      row.details.name.toLowerCase().includes(search);

    const selectedCollections = filters.collections ?? [];
    const matchesCollections =
      selectedCollections.length === 0 ||
      row.details.collections.some((c) => selectedCollections.includes(c.id));

    return matchesSearch && matchesCollections;
  };

  async edit(group: GroupRow, startingTabIndex: GroupAddEditTabType = GroupAddEditTabType.Info) {
    const organizationId = await firstValueFrom(this.organizationId$);
    if (organizationId == null) {
      return;
    }
    const dialogRef = openEditGroupDialog(this.dialogService, {
      data: {
        initialTab: startingTabIndex,
        organizationId,
        groupId: group.details.id,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);

    if (result == GroupAddEditDialogResultType.Saved) {
      this.refreshGroups$.next();
    } else if (result == GroupAddEditDialogResultType.Deleted) {
      this.removeGroup(group);
    }
  }

  async add(startingTabIndex: GroupAddEditTabType = GroupAddEditTabType.Info) {
    const organizationId = await firstValueFrom(this.organizationId$);
    if (organizationId == null) {
      return;
    }
    const dialogRef = openAddGroupDialog(this.dialogService, {
      data: {
        initialTab: startingTabIndex,
        organizationId,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);

    if (result == GroupAddEditDialogResultType.Saved) {
      this.refreshGroups$.next();
    }
  }

  /**
   * Stub for the bulk-actions bar's Delete action. Confirmation dialog, the actual delete call,
   * and the success toast land in a follow-up ticket — this ticket only wires selection and
   * surfaces the bar.
   */
  protected bulkDelete() {
    throw new Error("Not yet implemented — delete confirmation lands in a follow-up ticket.");
  }

  private removeGroup(group: GroupRow) {
    this.rows.set(this.rows().filter((r) => r !== group));
  }

  private toCollectionMap(
    response: ListResponse<CollectionResponse>,
  ): Observable<Record<string, CollectionView>> {
    const collections = response.data.map((r) =>
      Collection.fromCollectionData(new CollectionData(r as CollectionDetailsResponse)),
    );

    return this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.keyService.orgKeys$(userId)),
      switchMap((orgKeys) => this.collectionService.decryptMany$(collections, orgKeys ?? {})),
      map((decrypted) => {
        const collectionMap: Record<string, CollectionView> = {};
        decrypted.forEach((c) => (collectionMap[c.id] = c));
        return collectionMap;
      }),
    );
  }
}
