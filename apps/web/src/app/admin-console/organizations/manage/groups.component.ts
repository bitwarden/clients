import { ScrollingModule } from "@angular/cdk/scrolling";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  concatMap,
  from,
  lastValueFrom,
  map,
  Observable,
  switchMap,
  tap,
} from "rxjs";
import { debounceTime, first } from "rxjs/operators";

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
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  DialogService,
  IconModule,
  ScrollLayoutDirective,
  TableDataSource,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { Vfo1I18nPipe, Vfo1IconPipe } from "@bitwarden/vault";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";
import { GroupDetailsView, InternalGroupApiService as GroupService } from "../core";

import {
  GroupAddEditDialogResultType,
  GroupAddEditTabType,
  openAddGroupDialog,
  openEditGroupDialog,
} from "./group-add-edit";

type GroupDetailsRow = {
  /**
   * Details used for displaying group information
   */
  details: GroupDetailsView;

  /**
   * True if the group is selected in the table
   */
  checked?: boolean;

  /**
   * A list of collection names the group has access to
   */
  collectionNames?: string[];
};

/**
 * Custom filter predicate that filters the groups table by id and name only.
 * This is required because the default implementation searches by all properties, which can unintentionally match
 * with members' names (who are assigned to the group) or collection names (which the group has access to).
 */
const groupsFilter = (filter: string) => {
  filter ??= "";
  const transformedFilter = filter.trim().toLowerCase();
  return (data: GroupDetailsRow) => {
    const group = data.details;

    return (
      group.id.toLowerCase().indexOf(transformedFilter) != -1 ||
      group.name.toLowerCase().indexOf(transformedFilter) != -1
    );
  };
};

@Component({
  selector: "app-groups",
  templateUrl: "groups.component.html",
  imports: [
    SharedModule,
    HeaderModule,
    ScrollingModule,
    ScrollLayoutDirective,
    IconModule,
    Vfo1IconPipe,
    Vfo1I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupsComponent {
  private readonly apiService = inject(ApiService);
  private readonly groupService = inject(GroupService);
  private readonly route = inject(ActivatedRoute);
  private readonly i18nService = inject(I18nService);
  private readonly dialogService = inject(DialogService);
  private readonly logService = inject(LogService);
  private readonly collectionService = inject(CollectionService);
  private readonly toastService = inject(ToastService);
  private readonly keyService = inject(KeyService);
  private readonly accountService = inject(AccountService);
  private readonly configService = inject(ConfigService);

  protected readonly loading = signal(true);
  protected readonly organizationId = signal<string | undefined>(undefined);

  protected readonly dataSource = new TableDataSource<GroupDetailsRow>();
  protected readonly searchControl = new FormControl("");

  // Fixed sizes used for cdkVirtualScroll
  protected readonly rowHeight = 50;
  protected readonly rowHeightClass = `tw-h-[50px]`;

  protected readonly ModalTabType = GroupAddEditTabType;
  private readonly refreshGroups$ = new BehaviorSubject<void>(undefined);

  protected readonly btnTextAddCreateFeatureFlag = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM32380_BtnTextAddCreate),
    { initialValue: false },
  );

  constructor() {
    this.route.params
      .pipe(
        tap((params) => this.organizationId.set(params.organizationId)),
        switchMap((params) => {
          const organizationId: string = params.organizationId;
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
          return groups.map<GroupDetailsRow>((g) => ({
            id: g.id,
            name: g.name,
            details: g,
            checked: false,
            collectionNames: g.collections
              .map((c) => collectionMap[c.id]?.name)
              .sort(this.i18nService.collator?.compare),
          }));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((groups) => {
        this.dataSource.data = groups;
        this.loading.set(false);
      });

    // Connect the search input to the table dataSource filter input
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = groupsFilter(v ?? "")));

    this.route.queryParams.pipe(first(), takeUntilDestroyed()).subscribe((qParams) => {
      this.searchControl.setValue(qParams.search);
    });
  }

  async edit(
    group: GroupDetailsRow,
    startingTabIndex: GroupAddEditTabType = GroupAddEditTabType.Info,
  ) {
    const organizationId = this.organizationId();
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
    const organizationId = this.organizationId();
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

  async delete(groupRow: GroupDetailsRow) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: groupRow.details.name,
      content: { key: "deleteGroupConfirmation" },
      type: "warning",
    });
    if (!confirmed) {
      return false;
    }

    const organizationId = this.organizationId();
    if (organizationId == null) {
      return;
    }
    try {
      await this.groupService.delete(organizationId, groupRow.details.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("deletedGroupId", groupRow.details.name),
      });
      this.removeGroup(groupRow);
    } catch (e) {
      this.logService.error(e);
    }
  }

  async deleteAllSelected() {
    const groupsToDelete = this.dataSource.data.filter((g) => g.checked);

    if (groupsToDelete.length == 0) {
      return;
    }

    const deleteMessage = groupsToDelete.map((g) => g.details.name).join(", ");
    const confirmed = await this.dialogService.openSimpleDialog({
      title: {
        key: "deleteMultipleGroupsConfirmation",
        placeholders: [groupsToDelete.length.toString()],
      },
      content: deleteMessage,
      type: "warning",
    });
    if (!confirmed) {
      return false;
    }

    const organizationId = this.organizationId();
    if (organizationId == null) {
      return;
    }
    try {
      await this.groupService.deleteMany(
        organizationId,
        groupsToDelete.map((g) => g.details.id),
      );
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("deletedManyGroups", groupsToDelete.length.toString()),
      });

      groupsToDelete.forEach((g) => this.removeGroup(g));
    } catch (e) {
      this.logService.error(e);
    }
  }

  check(groupRow: GroupDetailsRow) {
    groupRow.checked = !groupRow.checked;
  }

  toggleAllVisible(event: Event) {
    const checked = (event.target as HTMLInputElement | null)?.checked ?? false;
    this.dataSource.filteredData?.forEach((g) => (g.checked = checked));
  }

  private removeGroup(groupRow: GroupDetailsRow) {
    // Assign a new array to dataSource.data to trigger the setters and update the table
    this.dataSource.data = this.dataSource.data.filter((g) => g !== groupRow);
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
      map((collections) => {
        const collectionMap: Record<string, CollectionView> = {};
        collections.forEach((c) => (collectionMap[c.id] = c));
        return collectionMap;
      }),
    );
  }
}
