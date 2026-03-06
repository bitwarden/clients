// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
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
import { debounceTime, first, startWith } from "rxjs/operators";

import {
  CollectionService,
  CollectionData,
  Collection,
  CollectionDetailsResponse,
  CollectionResponse,
  CollectionView,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, TableDataSource, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { GroupDetailsView, InternalGroupApiService as GroupService } from "../core";

import {
  GroupAddEditDialogResultType,
  GroupAddEditTabType,
  openGroupAddEditDialog,
} from "./group-add-edit.component";

type GroupDetailsRow = {
  id: string;
  name: string;

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
  collectionNames: string[];
};

/**
 * Custom filter predicate for groups.
 * The primary search matches group id/name, while the collection search narrows the list by collection names.
 * This avoids false positives from the default string search across unrelated row properties.
 */
const groupsFilter = (groupFilter: string, collectionFilter: string) => {
  const transformedGroupFilter = (groupFilter ?? "").trim().toLowerCase();
  const transformedCollectionFilter = (collectionFilter ?? "").trim().toLowerCase();

  return (data: GroupDetailsRow) => {
    const group = data.details;
    const matchesGroup =
      group.id.toLowerCase().includes(transformedGroupFilter) ||
      group.name.toLowerCase().includes(transformedGroupFilter);

    if (!matchesGroup) {
      return false;
    }

    if (transformedCollectionFilter.length === 0) {
      return true;
    }

    return data.collectionNames.some((collectionName) =>
      collectionName.toLowerCase().includes(transformedCollectionFilter),
    );
  };
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "groups.component.html",
  standalone: false,
})
export class GroupsComponent {
  loading = true;
  organizationId: string;

  protected dataSource = new TableDataSource<GroupDetailsRow>();
  protected searchControl = new FormControl("", { nonNullable: true });
  protected collectionSearchControl = new FormControl("", { nonNullable: true });

  // Fixed sizes used for cdkVirtualScroll
  protected rowHeight = 50;
  protected rowHeightClass = `tw-h-[50px]`;

  protected ModalTabType = GroupAddEditTabType;
  private refreshGroups$ = new BehaviorSubject<void>(null);

  constructor(
    private apiService: ApiService,
    private groupService: GroupService,
    private route: ActivatedRoute,
    private i18nService: I18nService,
    private dialogService: DialogService,
    private logService: LogService,
    private collectionService: CollectionService,
    private toastService: ToastService,
    private keyService: KeyService,
    private accountService: AccountService,
  ) {
    this.route.params
      .pipe(
        tap((params) => (this.organizationId = params.organizationId)),
        switchMap(() =>
          combineLatest([
            // collectionMap
            from(this.apiService.getCollections(this.organizationId)).pipe(
              concatMap((response) => this.toCollectionMap(response)),
            ),
            // groups
            this.refreshGroups$.pipe(
              switchMap(() => this.groupService.getAllDetails(this.organizationId)),
            ),
          ]),
        ),
        map(([collectionMap, groups]) => {
          return groups.map<GroupDetailsRow>((g) => ({
            collectionNames: g.collections
              .map((c) => collectionMap[c.id]?.name)
              .filter((name): name is string => typeof name === "string")
              .sort(this.i18nService.collator?.compare),
            id: g.id,
            name: g.name,
            details: g,
            checked: false,
          }));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((groups) => {
        this.dataSource.data = groups;
        this.loading = false;
      });

    // Connect both search inputs to the table dataSource filter input
    combineLatest([
      this.searchControl.valueChanges.pipe(debounceTime(200), startWith(this.searchControl.value)),
      this.collectionSearchControl.valueChanges.pipe(
        debounceTime(200),
        startWith(this.collectionSearchControl.value),
      ),
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([groupFilter, collectionFilter]) => {
        this.dataSource.filter = groupsFilter(groupFilter, collectionFilter);
      });

    this.route.queryParams.pipe(first(), takeUntilDestroyed()).subscribe((qParams) => {
      this.searchControl.setValue(qParams.search ?? "");
    });
  }

  async edit(
    group: GroupDetailsRow,
    startingTabIndex: GroupAddEditTabType = GroupAddEditTabType.Info,
  ) {
    const dialogRef = openGroupAddEditDialog(this.dialogService, {
      data: {
        initialTab: startingTabIndex,
        organizationId: this.organizationId,
        groupId: group != null ? group.details.id : null,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);

    if (result == GroupAddEditDialogResultType.Saved) {
      this.refreshGroups$.next();
    } else if (result == GroupAddEditDialogResultType.Deleted) {
      this.removeGroup(group);
    }
  }

  async add() {
    await this.edit(null);
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

    try {
      await this.groupService.delete(this.organizationId, groupRow.details.id);
      this.toastService.showToast({
        variant: "success",
        title: null,
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

    try {
      await this.groupService.deleteMany(
        this.organizationId,
        groupsToDelete.map((g) => g.details.id),
      );
      this.toastService.showToast({
        variant: "success",
        title: null,
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
    this.dataSource.filteredData.forEach(
      (g) => (g.checked = (event.target as HTMLInputElement).checked),
    );
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
      switchMap((orgKeys) => this.collectionService.decryptMany$(collections, orgKeys)),
      map((collections) => {
        const collectionMap: Record<string, CollectionView> = {};
        collections.forEach((c) => (collectionMap[c.id] = c));
        return collectionMap;
      }),
    );
  }
}
