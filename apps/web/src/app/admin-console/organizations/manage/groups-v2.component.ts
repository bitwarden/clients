import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  concatMap,
  filter,
  firstValueFrom,
  lastValueFrom,
  map,
  Observable,
  shareReplay,
  switchMap,
} from "rxjs";
import { first } from "rxjs/operators";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  CollectionView,
  CollectionDetailsResponse,
  CollectionResponse,
  Collection,
  CollectionData,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { getById } from "@bitwarden/common/platform/misc";
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
  IconModule,
  MenuModule,
  SearchModule,
  type SelectionConfig,
  StatusLockupComponent,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { Vfo1I18nPipe, Vfo1TerminologyService } from "@bitwarden/vault";

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
  details: GroupDetailsView;

  collectionBadges: BadgeGroupItem[];
};

type GroupFilters = {
  search?: string;
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
    StatusLockupComponent,
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
  private readonly organizationService = inject(OrganizationService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);

  private readonly refreshGroups$ = new BehaviorSubject<void>(undefined);

  private readonly tableRef =
    viewChild.required<BitTableV2Component<GroupRow>>(BitTableV2Component);

  protected readonly searchControl = new FormControl("");

  protected readonly ModalTabType = GroupAddEditTabType;

  protected readonly selection: SelectionConfig<GroupRow> = { multiple: true };

  protected readonly selectedGroups = signal<readonly GroupRow[]>([]);

  protected readonly initialFilters: Partial<GroupFilters> = {
    search: this.route.snapshot.queryParams.search ?? "",
  };

  private readonly organizationId$ = this.route.params.pipe(map((params) => params.organizationId));

  private readonly userId$ = this.accountService.activeAccount$.pipe(
    getUserId,
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  private readonly organization$ = combineLatest([this.organizationId$, this.userId$]).pipe(
    switchMap(([organizationId, userId]) =>
      this.organizationService.organizations$(userId).pipe(getById(organizationId)),
    ),
    filter((organization): organization is Organization => organization != null),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  protected readonly organizationName = toSignal(this.organization$.pipe(map((o) => o.name)));

  private readonly collectionMap$ = this.organizationId$.pipe(
    switchMap((organizationId) => this.apiService.getCollections(organizationId)),
    concatMap((collections) => this.toCollectionMap(collections)),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  private readonly rowsData$ = this.organizationId$.pipe(
    switchMap((organizationId) =>
      combineLatest([
        this.collectionMap$,
        this.refreshGroups$.pipe(switchMap(() => this.groupService.getAllDetails(organizationId))),
      ]),
    ),
    map(([collectionMap, groups]) => {
      const sharedFolderIcon = this.vfo1Terminology.iconClass("bwi-collection-shared");
      return groups.map<GroupRow>((g) => ({
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
    }),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  protected readonly collectionFilterOptions$ = combineLatest([
    this.rowsData$,
    this.collectionMap$,
  ]).pipe(
    map(([rows, collectionMap]) => {
      const hasCollection = (row: GroupRow, collectionId: string) =>
        row.details.collections.some((c) => c.id === collectionId);

      return Object.values(collectionMap)
        .sort((a, b) => this.i18nService.collator?.compare(a.name, b.name) ?? 0)
        .map((collection) => ({
          value: collection.id,
          label: collection.name,
          count: rows.filter((row) => hasCollection(row, collection.id)).length,
        }));
    }),
  );

  private readonly fetchedRows = toSignal(this.rowsData$);
  protected readonly loading = computed(() => this.fetchedRows() == null);

  protected readonly rows = signal<GroupRow[]>([]);

  protected readonly table = defineTable<GroupRow, "actions">(this.rows);

  protected readonly hasNoGroups = computed(() => !this.loading() && this.rows().length === 0);

  constructor() {
    effect(() => {
      this.rows.set(this.fetchedRows() ?? []);
    });

    effect(() => {
      const currentRows = new Set(this.rows());
      const model = this.tableRef().selectionModel();
      const stale = model?.selected().filter((row) => !currentRows.has(row)) ?? [];
      if (stale.length > 0) {
        model?.deselect(...stale);
      }
    });

    this.route.queryParams.pipe(first(), takeUntilDestroyed()).subscribe((qParams) => {
      this.searchControl.setValue(qParams.search);
    });
  }

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
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("groupEdited"),
      });
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

  protected readonly confirmDelete = async (groups: GroupRow[]): Promise<void> => {
    if (groups.length === 0) {
      return;
    }

    const bulk = groups.length > 1;
    const confirmed = await this.dialogService.openSimpleDialog({
      title: bulk
        ? { key: "deleteGroups", placeholders: [groups.length.toString()] }
        : { key: "deleteGroup" },
      content: { key: bulk ? "deleteGroupsWarningDesc" : "deleteGroupWarningDesc" },
      type: "danger",
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
    });
    if (!confirmed) {
      return;
    }

    const organizationId = await firstValueFrom(this.organizationId$);
    if (organizationId == null) {
      return;
    }

    try {
      await this.groupService.deleteMany(
        organizationId,
        groups.map((g) => g.details.id),
      );
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(bulk ? "groupsDeleted" : "groupDeleted"),
      });
      groups.forEach((g) => this.removeGroup(g));
    } catch (e) {
      this.logService.error(e);
    }
  };

  protected readonly confirmDeleteSelected = (): void => {
    void this.confirmDelete([...this.selectedGroups()]);
  };

  private removeGroup(group: GroupRow) {
    this.rows.update((rows) => rows.filter((r) => r !== group));
  }

  private toCollectionMap(
    response: ListResponse<CollectionResponse>,
  ): Observable<Record<string, CollectionView>> {
    const collections = response.data.map((r) =>
      Collection.fromCollectionData(new CollectionData(r as CollectionDetailsResponse)),
    );

    return this.userId$.pipe(
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
