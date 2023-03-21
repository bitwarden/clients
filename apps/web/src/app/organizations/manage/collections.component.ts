import { Component, OnInit, ViewChild, ViewContainerRef } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, lastValueFrom } from "rxjs";
import { first } from "rxjs/operators";

import { ModalService } from "@bitwarden/angular/services/modal.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CollectionService } from "@bitwarden/common/abstractions/collection.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { OrganizationService } from "@bitwarden/common/abstractions/organization/organization.service.abstraction";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { ProductType } from "@bitwarden/common/enums/productType";
import { CollectionData } from "@bitwarden/common/models/data/collection.data";
import { Collection } from "@bitwarden/common/models/domain/collection";
import { Organization } from "@bitwarden/common/models/domain/organization";
import {
  CollectionDetailsResponse,
  CollectionResponse,
} from "@bitwarden/common/models/response/collection.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { CollectionView } from "@bitwarden/common/models/view/collection.view";
import { Guid } from "@bitwarden/common/types/guid";
import {
  DialogService,
  SimpleDialogCloseType,
  SimpleDialogOptions,
  SimpleDialogType,
} from "@bitwarden/components";

import { CollectionDialogResult, openCollectionDialog } from "../shared";

import { EntityUsersComponent } from "./entity-users.component";

@Component({
  selector: "app-org-manage-collections",
  templateUrl: "collections.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class CollectionsComponent implements OnInit {
  @ViewChild("addEdit", { read: ViewContainerRef, static: true }) addEditModalRef: ViewContainerRef;
  @ViewChild("usersTemplate", { read: ViewContainerRef, static: true })
  usersModalRef: ViewContainerRef;

  loading = true;
  organization: Organization;
  canCreate = false;
  organizationId: Guid;
  collections: CollectionView[];
  assignedCollections: CollectionView[];
  pagedCollections: CollectionView[];
  searchText: string;

  protected didScroll = false;
  protected pageSize = 100;

  private pagedCollectionsCount = 0;

  constructor(
    private apiService: ApiService,
    private route: ActivatedRoute,
    private collectionService: CollectionService,
    private modalService: ModalService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private searchService: SearchService,
    private logService: LogService,
    private organizationService: OrganizationService,
    private dialogService: DialogService,
    private router: Router
  ) {}

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.parent.params.subscribe(async (params) => {
      this.organizationId = params.organizationId;
      await this.load();
      // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe, rxjs/no-nested-subscribe
      this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
        this.searchText = qParams.search;
      });
    });
  }

  async load() {
    this.organization = await this.organizationService.get(this.organizationId);
    this.canCreate = this.organization.canCreateNewCollections;

    const decryptCollections = async (r: ListResponse<CollectionResponse>) => {
      const collections = r.data
        .filter((c) => c.organizationId === this.organizationId)
        .map((d) => new Collection(new CollectionData(d as CollectionDetailsResponse)));
      return await this.collectionService.decryptMany(collections);
    };

    if (this.organization.canViewAssignedCollections) {
      const response = await this.apiService.getUserCollections();
      this.assignedCollections = await decryptCollections(response);
    }

    if (this.organization.canViewAllCollections) {
      const response = await this.apiService.getCollections(this.organizationId);
      this.collections = await decryptCollections(response);
    } else {
      this.collections = this.assignedCollections;
    }

    this.resetPaging();
    this.loading = false;
  }

  loadMore() {
    if (!this.collections || this.collections.length <= this.pageSize) {
      return;
    }
    const pagedLength = this.pagedCollections.length;
    let pagedSize = this.pageSize;
    if (pagedLength === 0 && this.pagedCollectionsCount > this.pageSize) {
      pagedSize = this.pagedCollectionsCount;
    }
    if (this.collections.length > pagedLength) {
      this.pagedCollections = this.pagedCollections.concat(
        this.collections.slice(pagedLength, pagedLength + pagedSize)
      );
    }
    this.pagedCollectionsCount = this.pagedCollections.length;
    this.didScroll = this.pagedCollections.length > this.pageSize;
  }

  async edit(collection?: CollectionView) {
    const canCreate = collection == undefined && this.canCreate;
    const canEdit = collection != undefined && this.canEdit(collection);
    const canDelete = collection != undefined && this.canDelete(collection);

    if (!(canCreate || canEdit || canDelete)) {
      this.platformUtilsService.showToast("error", null, this.i18nService.t("missingPermissions"));
      return;
    }

    if (
      !collection &&
      this.organization.planProductType === ProductType.Free &&
      this.collections.length === this.organization.maxCollections
    ) {
      // Show org upgrade modal
      // It might be worth creating a simple
      // org upgrade dialog service to launch the dialog here and in the people.comp
      // once the enterprise pod is done w/ their organization module refactor.
      const orgUpgradeSimpleDialogOpts: SimpleDialogOptions = {
        title: this.i18nService.t("upgradeOrganization"),
        content: this.i18nService.t(
          this.organization.canManageBilling
            ? "freeOrgMaxCollectionReachedManageBilling"
            : "freeOrgMaxCollectionReachedNoManageBilling",
          this.organization.maxCollections
        ),
        type: SimpleDialogType.PRIMARY,
      };

      if (this.organization.canManageBilling) {
        orgUpgradeSimpleDialogOpts.acceptButtonText = this.i18nService.t("upgrade");
      } else {
        orgUpgradeSimpleDialogOpts.acceptButtonText = this.i18nService.t("ok");
        orgUpgradeSimpleDialogOpts.cancelButtonText = null; // hide secondary btn
      }

      const simpleDialog = this.dialogService.openSimpleDialog(orgUpgradeSimpleDialogOpts);

      firstValueFrom(simpleDialog.closed).then((result: SimpleDialogCloseType | undefined) => {
        if (!result) {
          return;
        }

        if (result == SimpleDialogCloseType.ACCEPT && this.organization.canManageBilling) {
          this.router.navigate(
            ["/organizations", this.organization.id, "billing", "subscription"],
            { queryParams: { upgrade: true } }
          );
        }
      });

      return;
    }

    const dialog = openCollectionDialog(this.dialogService, {
      data: { collectionId: collection?.id, organizationId: this.organizationId },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === CollectionDialogResult.Saved || result === CollectionDialogResult.Deleted) {
      this.load();
    }
  }

  add() {
    this.edit(null);
  }

  async delete(collection: CollectionView) {
    const confirmed = await this.platformUtilsService.showDialog(
      this.i18nService.t("deleteCollectionConfirmation"),
      collection.name,
      this.i18nService.t("yes"),
      this.i18nService.t("no"),
      "warning"
    );
    if (!confirmed) {
      return false;
    }

    try {
      await this.apiService.deleteCollection(this.organizationId, collection.id);
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("deletedCollectionId", collection.name)
      );
      this.removeCollection(collection);
    } catch (e) {
      this.logService.error(e);
      this.platformUtilsService.showToast("error", null, this.i18nService.t("missingPermissions"));
    }
  }

  async users(collection: CollectionView) {
    const [modal] = await this.modalService.openViewRef(
      EntityUsersComponent,
      this.usersModalRef,
      (comp) => {
        comp.organizationId = this.organizationId;
        comp.entity = "collection";
        comp.entityId = collection.id;
        comp.entityName = collection.name;

        // eslint-disable-next-line rxjs-angular/prefer-takeuntil
        comp.onEditedUsers.subscribe(() => {
          this.load();
          modal.close();
        });
      }
    );
  }

  async resetPaging() {
    this.pagedCollections = [];
    this.loadMore();
  }

  isSearching() {
    return this.searchService.isSearchable(this.searchText);
  }

  isPaging() {
    const searching = this.isSearching();
    if (searching && this.didScroll) {
      this.resetPaging();
    }
    return !searching && this.collections && this.collections.length > this.pageSize;
  }

  canEdit(collection: CollectionView) {
    if (this.organization.canEditAnyCollection) {
      return true;
    }

    if (
      this.organization.canEditAssignedCollections &&
      this.assignedCollections.some((c) => c.id === collection.id)
    ) {
      return true;
    }
    return false;
  }

  canDelete(collection: CollectionView) {
    if (this.organization.canDeleteAnyCollection) {
      return true;
    }

    if (
      this.organization.canDeleteAssignedCollections &&
      this.assignedCollections.some((c) => c.id === collection.id)
    ) {
      return true;
    }
    return false;
  }

  private removeCollection(collection: CollectionView) {
    const index = this.collections.indexOf(collection);
    if (index > -1) {
      this.collections.splice(index, 1);
      this.resetPaging();
    }
  }
}
