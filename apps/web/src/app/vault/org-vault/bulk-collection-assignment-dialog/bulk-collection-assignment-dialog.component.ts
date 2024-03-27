import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { Subject } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherId, CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { DialogService, SelectItemView } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

export interface BulkCollectionAssignmentDialogParams {
  organizationId: OrganizationId;

  /**
   * The ciphers to be assigned to the collections selected in the dialog.
   */
  ciphers: CipherView[];

  /**
   * The collections available to assign the ciphers to.
   */
  availableCollections: CollectionView[];

  /**
   * The currently filtered collection. Selected by default. If the user deselects it in the dialog then it will be
   * removed from the ciphers upon submission.
   */
  activeCollection?: CollectionView;
}

export enum BulkCollectionAssignmentDialogResult {
  Saved = "saved",
  Canceled = "canceled",
}

@Component({
  imports: [SharedModule],
  selector: "app-bulk-collection-assignment-dialog",
  templateUrl: "./bulk-collection-assignment-dialog.component.html",
  standalone: true,
})
export class BulkCollectionAssignmentDialogComponent implements OnDestroy, OnInit {
  protected totalItemCount: number;
  protected editableItemCount: number;
  protected readonlyItemCount: number;
  protected availableCollections: SelectItemView[] = [];
  protected selectedCollections: SelectItemView[] = [];

  private editableItems: CipherView[] = [];
  private destroy$ = new Subject<void>();

  protected pluralize = (count: number, singular: string, plural: string) =>
    `${count} ${this.i18nService.t(count === 1 ? singular : plural)}`;

  constructor(
    @Inject(DIALOG_DATA) private params: BulkCollectionAssignmentDialogParams,
    private dialogRef: DialogRef<BulkCollectionAssignmentDialogResult>,
    private cipherService: CipherService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private configService: ConfigService,
    private organizationService: OrganizationService,
  ) {}

  async ngOnInit() {
    const v1FCEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.FlexibleCollectionsV1,
      false,
    );
    const org = await this.organizationService.get(this.params.organizationId);

    if (org.canEditAllCiphers(v1FCEnabled)) {
      this.editableItems = this.params.ciphers;
    } else {
      this.editableItems = this.params.ciphers.filter((c) => c.edit);
    }

    this.editableItemCount = this.editableItems.length;

    // If no ciphers are editable, close the dialog
    if (this.editableItemCount == 0) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("nothingSelected"),
      );
      this.dialogRef.close(BulkCollectionAssignmentDialogResult.Canceled);
    }

    this.totalItemCount = this.params.ciphers.length;
    this.readonlyItemCount = this.totalItemCount - this.editableItemCount;

    this.availableCollections = this.params.availableCollections.map((c) => ({
      icon: "bwi-collection",
      id: c.id,
      labelName: c.name,
      listName: c.name,
    }));

    // If the active collection is set, select it by default
    if (this.params.activeCollection) {
      this.selectCollections([
        {
          icon: "bwi-collection",
          id: this.params.activeCollection.id,
          labelName: this.params.activeCollection.name,
          listName: this.params.activeCollection.name,
        },
      ]);
    }
  }

  private sortItems = (a: SelectItemView, b: SelectItemView) =>
    this.i18nService.collator.compare(a.labelName, b.labelName);

  selectCollections(items: SelectItemView[]) {
    this.selectedCollections = [...this.selectedCollections, ...items].sort(this.sortItems);

    this.availableCollections = this.availableCollections.filter(
      (item) => !items.find((i) => i.id === item.id),
    );
  }

  unselectCollection(i: number) {
    const removed = this.selectedCollections.splice(i, 1);
    this.availableCollections = [...this.availableCollections, ...removed].sort(this.sortItems);
  }

  get isValid() {
    return this.params.activeCollection != null || this.selectedCollections.length > 0;
  }

  submit = async () => {
    if (!this.isValid) {
      return;
    }

    const cipherIds = this.editableItems.map((i) => i.id as CipherId);

    if (this.selectedCollections.length > 0) {
      await this.cipherService.bulkUpdateCollectionsWithServer(
        this.params.organizationId,
        cipherIds,
        this.selectedCollections.map((i) => i.id as CollectionId),
        false,
      );
    }

    if (
      this.params.activeCollection != null &&
      this.selectedCollections.find((c) => c.id === this.params.activeCollection.id) == null
    ) {
      await this.cipherService.bulkUpdateCollectionsWithServer(
        this.params.organizationId,
        cipherIds,
        [this.params.activeCollection.id as CollectionId],
        true,
      );
    }

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("successfullyAssignedCollections"),
    );

    this.dialogRef.close(BulkCollectionAssignmentDialogResult.Saved);
  };

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<BulkCollectionAssignmentDialogParams>,
  ) {
    return dialogService.open<
      BulkCollectionAssignmentDialogResult,
      BulkCollectionAssignmentDialogParams
    >(BulkCollectionAssignmentDialogComponent, config);
  }
}
