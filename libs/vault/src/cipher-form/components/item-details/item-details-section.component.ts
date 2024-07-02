import { CommonModule, NgClass } from "@angular/common";
import { Component, DestroyRef, Input, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { concatMap, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import {
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectItemView,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";

import {
  CipherFormConfig,
  OptionalInitialValues,
} from "../../abstractions/cipher-form-config.service";
import { CipherFormContainer } from "../../cipher-form-container";

@Component({
  selector: "vault-item-details-section",
  templateUrl: "./item-details-section.component.html",
  standalone: true,
  imports: [
    CardComponent,
    SectionComponent,
    TypographyModule,
    FormFieldModule,
    ReactiveFormsModule,
    SelectModule,
    SectionHeaderComponent,
    IconButtonModule,
    NgClass,
    JslibModule,
    CommonModule,
  ],
})
export class ItemDetailsSectionComponent implements OnInit {
  itemDetailsForm = this.formBuilder.group({
    name: ["", [Validators.required]],
    organizationId: [null],
    folderId: [null],
    collectionIds: new FormControl([], [Validators.required]),
    favorite: [false],
  });

  /**
   * Collection options available for the selected organization.
   * @protected
   */
  protected collectionOptions: SelectItemView[] = [];

  /**
   * Collections that are already assigned to the cipher and are read-only. These cannot be removed.
   * @protected
   */
  protected readOnlyCollections: string[] = [];

  protected showCollectionsControl: boolean;

  @Input({ required: true })
  config: CipherFormConfig;

  @Input()
  originalCipherView: CipherView;
  /**
   * Whether the form is in partial edit mode. Only the folder and favorite controls are available.
   */
  get partialEdit(): boolean {
    return this.config.mode === "partial-edit";
  }

  get organizations(): Organization[] {
    return this.config.organizations;
  }

  get allowPersonalOwnership() {
    return this.config.allowPersonalOwnership;
  }

  get collections(): CollectionView[] {
    return this.config.collections;
  }

  get initialValues(): OptionalInitialValues | undefined {
    return this.config.initialValues;
  }

  constructor(
    private cipherFormContainer: CipherFormContainer,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private destroyRef: DestroyRef,
  ) {
    this.cipherFormContainer.registerChildForm("itemDetails", this.itemDetailsForm);
    this.itemDetailsForm.valueChanges
      .pipe(
        takeUntilDestroyed(),
        // getRawValue() because organizationId can be disabled for edit mode
        map(() => this.itemDetailsForm.getRawValue()),
      )
      .subscribe((value) => {
        this.cipherFormContainer.patchCipher({
          name: value.name,
          organizationId: value.organizationId,
          folderId: value.folderId,
          collectionIds: value.collectionIds?.map((c) => c.id) || [],
          favorite: value.favorite,
        });
      });
  }

  get favoriteIcon() {
    return this.itemDetailsForm.controls.favorite.value ? "bwi-star-f" : "bwi-star";
  }

  toggleFavorite() {
    this.itemDetailsForm.controls.favorite.setValue(!this.itemDetailsForm.controls.favorite.value);
  }

  get allowOwnershipChange() {
    // Do not allow ownership change in edit mode.
    if (this.config.mode === "edit") {
      return false;
    }

    // If personal ownership is allowed and there is at least one organization, allow ownership change.
    if (this.allowPersonalOwnership) {
      return this.organizations.length > 0;
    }

    // Personal ownership is not allowed, only allow ownership change if there is more than one organization.
    return this.organizations.length > 1;
  }

  get showOwnership() {
    return (
      this.allowOwnershipChange || (this.organizations.length > 0 && this.config.mode === "edit")
    );
  }

  get defaultOwner() {
    return this.allowPersonalOwnership ? null : this.organizations[0].id;
  }

  async ngOnInit() {
    if (!this.allowPersonalOwnership && this.organizations.length === 0) {
      throw new Error("No organizations available for ownership.");
    }

    if (this.originalCipherView) {
      await this.initFromExistingCipher();
    } else {
      this.itemDetailsForm.setValue({
        name: "",
        organizationId: this.initialValues?.organizationId || this.defaultOwner,
        folderId: this.initialValues?.folderId || null,
        collectionIds: [],
        favorite: false,
      });
      await this.updateCollectionOptions(this.initialValues?.collectionIds || []);
    }

    if (!this.allowOwnershipChange) {
      this.itemDetailsForm.controls.organizationId.disable();
    }

    this.itemDetailsForm.controls.organizationId.valueChanges
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        concatMap(async () => {
          await this.updateCollectionOptions();
        }),
      )
      .subscribe();
  }

  private async initFromExistingCipher() {
    this.itemDetailsForm.setValue({
      name: this.originalCipherView.name,
      organizationId: this.originalCipherView.organizationId,
      folderId: this.originalCipherView.folderId,
      collectionIds: [],
      favorite: this.originalCipherView.favorite,
    });

    // Configure form for clone mode.
    if (this.config.mode === "clone") {
      this.itemDetailsForm.controls.name.setValue(
        this.originalCipherView.name + " - " + this.i18nService.t("clone"),
      );

      if (!this.allowPersonalOwnership && this.originalCipherView.organizationId == null) {
        this.itemDetailsForm.controls.organizationId.setValue(this.defaultOwner);
      }
    }

    await this.updateCollectionOptions(this.originalCipherView.collectionIds as CollectionId[]);

    if (this.partialEdit) {
      this.itemDetailsForm.disable();
      this.itemDetailsForm.controls.favorite.enable();
      this.itemDetailsForm.controls.folderId.enable();
    } else if (this.config.mode === "edit") {
      //
      this.readOnlyCollections = this.collections
        .filter(
          (c) => c.readOnly && this.originalCipherView.collectionIds.includes(c.id as CollectionId),
        )
        .map((c) => c.name);
    }
  }

  /**
   * Updates the collection options based on the selected organization.
   * @param startingSelection - Optional starting selection of collectionIds to be automatically selected.
   * @private
   */
  private async updateCollectionOptions(startingSelection: CollectionId[] = []) {
    const orgId = this.itemDetailsForm.controls.organizationId.value as OrganizationId;
    const collectionsControl = this.itemDetailsForm.controls.collectionIds;

    // No organization selected, disable/hide the collections control.
    if (orgId == null) {
      this.collectionOptions = [];
      collectionsControl.reset();
      collectionsControl.disable();
      this.showCollectionsControl = false;
      return;
    }

    this.collectionOptions = this.collections
      .filter((c) => {
        // If partial edit mode, show all org collections because the control is disabled.
        return c.organizationId === orgId && (this.partialEdit || !c.readOnly);
      })
      .map((c) => ({
        id: c.id,
        name: c.name,
        listName: c.name,
        labelName: c.name,
      }));

    collectionsControl.reset();
    collectionsControl.enable();
    this.showCollectionsControl = true;

    // If there is only one collection, select it by default.
    if (this.collectionOptions.length === 1) {
      collectionsControl.setValue(this.collectionOptions);
      return;
    }

    if (startingSelection.length > 0) {
      collectionsControl.setValue(
        this.collectionOptions.filter((c) => startingSelection.includes(c.id as CollectionId)),
      );
    }
  }
}
