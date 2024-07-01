import { Component, OnDestroy, OnInit, ViewChild, ViewContainerRef } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  concatMap,
  from,
  lastValueFrom,
  map,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";
import { first } from "rxjs/operators";

import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { CollectionData } from "@bitwarden/common/vault/models/data/collection.data";
import { Collection } from "@bitwarden/common/vault/models/domain/collection";
import {
  CollectionDetailsResponse,
  CollectionResponse,
} from "@bitwarden/common/vault/models/response/collection.response";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { DialogService } from "@bitwarden/components";

import { InternalGroupService as GroupService, GroupView } from "../core";

import {
  GroupAddEditDialogResultType,
  GroupAddEditTabType,
  openGroupAddEditDialog,
} from "./group-add-edit.component";

type CollectionViewMap = {
  [id: string]: CollectionView;
};

type GroupDetailsRow = {
  /**
   * Group Id (used for searching)
   */
  id: string;

  /**
   * Group name (used for searching)
   */
  name: string;

  /**
   * Details used for displaying group information
   */
  details: GroupView;

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
 * @deprecated To be replaced with NewGroupsComponent which significantly refactors this component.
 * The GroupsComponentRefactor flag switches between the old and new components; this component will be removed when
 * the feature flag is removed.
 */
@Component({
  selector: "app-org-groups",
  templateUrl: "groups.component.html",
})
export class GroupsComponent implements OnInit, OnDestroy {
  @ViewChild("addEdit", { read: ViewContainerRef, static: true }) addEditModalRef: ViewContainerRef;
  @ViewChild("usersTemplate", { read: ViewContainerRef, static: true })
  usersModalRef: ViewContainerRef;

  loading = true;
  organizationId: string;
  groups: GroupDetailsRow[];

  protected didScroll = false;
  protected pageSize = 100;
  protected ModalTabType = GroupAddEditTabType;

  private pagedGroupsCount = 0;
  private pagedGroups: GroupDetailsRow[];
  private searchedGroups: GroupDetailsRow[];
  private _searchText$ = new BehaviorSubject<string>("");
  private destroy$ = new Subject<void>();
  private refreshGroups$ = new BehaviorSubject<void>(null);
  private isSearching: boolean = false;

  get searchText() {
    return this._searchText$.value;
  }
  set searchText(value: string) {
    this._searchText$.next(value);
    // Manually update as we are not using the search pipe in the template
    this.updateSearchedGroups();
  }

  /**
   * The list of groups that should be visible in the table.
   * This is needed as there are two modes (paging/searching) and
   * we need a reference to the currently visible groups for
   * the Select All checkbox
   */
  get visibleGroups(): GroupDetailsRow[] {
    if (this.isPaging()) {
      return this.pagedGroups;
    }
    if (this.isSearching) {
      return this.searchedGroups;
    }
    return this.groups;
  }

  constructor(
    private apiService: ApiService,
    private groupService: GroupService,
    private route: ActivatedRoute,
    private i18nService: I18nService,
    private dialogService: DialogService,
    private platformUtilsService: PlatformUtilsService,
    private searchService: SearchService,
    private logService: LogService,
    private collectionService: CollectionService,
    private searchPipe: SearchPipe,
  ) {}

  async ngOnInit() {
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
              switchMap(() => this.groupService.getAll(this.organizationId)),
            ),
          ]),
        ),
        map(([collectionMap, groups]) => {
          return groups
            .sort(Utils.getSortFunction(this.i18nService, "name"))
            .map<GroupDetailsRow>((g) => ({
              id: g.id,
              name: g.name,
              details: g,
              checked: false,
              collectionNames: g.collections
                .map((c) => collectionMap[c.id]?.name)
                .sort(this.i18nService.collator?.compare),
            }));
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((groups) => {
        this.groups = groups;
        this.resetPaging();
        this.updateSearchedGroups();
        this.loading = false;
      });

    this.route.queryParams
      .pipe(
        first(),
        concatMap(async (qParams) => {
          this.searchText = qParams.search;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this._searchText$
      .pipe(
        switchMap((searchText) => this.searchService.isSearchable(searchText)),
        takeUntil(this.destroy$),
      )
      .subscribe((isSearchable) => {
        this.isSearching = isSearchable;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadMore() {
    if (!this.groups || this.groups.length <= this.pageSize) {
      return;
    }
    const pagedLength = this.pagedGroups.length;
    let pagedSize = this.pageSize;
    if (pagedLength === 0 && this.pagedGroupsCount > this.pageSize) {
      pagedSize = this.pagedGroupsCount;
    }
    if (this.groups.length > pagedLength) {
      this.pagedGroups = this.pagedGroups.concat(
        this.groups.slice(pagedLength, pagedLength + pagedSize),
      );
    }
    this.pagedGroupsCount = this.pagedGroups.length;
    this.didScroll = this.pagedGroups.length > this.pageSize;
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
      this.removeGroup(group.details.id);
    }
  }

  add() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.edit(null);
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
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("deletedGroupId", groupRow.details.name),
      );
      this.removeGroup(groupRow.details.id);
    } catch (e) {
      this.logService.error(e);
    }
  }

  async deleteAllSelected() {
    const groupsToDelete = this.groups.filter((g) => g.checked);

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
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("deletedManyGroups", groupsToDelete.length.toString()),
      );

      groupsToDelete.forEach((g) => this.removeGroup(g.details.id));
    } catch (e) {
      this.logService.error(e);
    }
  }

  resetPaging() {
    this.pagedGroups = [];
    this.loadMore();
  }

  check(groupRow: GroupDetailsRow) {
    groupRow.checked = !groupRow.checked;
  }

  toggleAllVisible(event: Event) {
    this.visibleGroups.forEach((g) => (g.checked = (event.target as HTMLInputElement).checked));
  }

  isPaging() {
    const searching = this.isSearching;
    if (searching && this.didScroll) {
      this.resetPaging();
    }
    return !searching && this.groups && this.groups.length > this.pageSize;
  }

  private removeGroup(id: string) {
    const index = this.groups.findIndex((g) => g.details.id === id);
    if (index > -1) {
      this.groups.splice(index, 1);
      this.resetPaging();
      this.updateSearchedGroups();
    }
  }

  private async toCollectionMap(response: ListResponse<CollectionResponse>) {
    const collections = response.data.map(
      (r) => new Collection(new CollectionData(r as CollectionDetailsResponse)),
    );
    const decryptedCollections = await this.collectionService.decryptMany(collections);

    // Convert to an object using collection Ids as keys for faster name lookups
    const collectionMap: CollectionViewMap = {};
    decryptedCollections.forEach((c) => (collectionMap[c.id] = c));

    return collectionMap;
  }

  private updateSearchedGroups() {
    if (this.isSearching) {
      // Making use of the pipe in the component as we need know which groups where filtered
      this.searchedGroups = this.searchPipe.transform(
        this.groups,
        this.searchText,
        (group) => group.details.name,
        (group) => group.details.id,
      );
    }
  }
}
