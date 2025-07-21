// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, DestroyRef, Input, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { concatMap, firstValueFrom, map } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionTypes, CollectionView } from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { OrganizationUserType, PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  SectionHeaderComponent,
  SelectItemView,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";

import {
  CipherFormConfig,
  OptionalInitialValues,
} from "../../abstractions/cipher-form-config.service";
import { CipherForm, CipherFormContainer } from "../../cipher-form-container";

@Component({
  selector: "vault-item-details-section",
  templateUrl: "./item-details-section.component.html",
  imports: [
    CardComponent,
    TypographyModule,
    FormFieldModule,
    ReactiveFormsModule,
    SelectModule,
    SectionHeaderComponent,
    IconButtonModule,
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
  protected readOnlyCollections: CollectionView[] = [];

  protected showCollectionsControl: boolean;

  /** The email address associated with the active account */
  protected userEmail$ = this.accountService.activeAccount$.pipe(map((account) => account.email));

  protected organizations: Organization[] = [];

  protected userId: UserId;

  @Input({ required: true })
  config: CipherFormConfig;

  @Input()
  originalCipherView: CipherView;

  @Input()
  cipherForm: FormGroup<CipherForm>;

  get readOnlyCollectionsNames(): string[] {
    return this.readOnlyCollections.map((c) => c.name);
  }
  /**
   * Whether the form is in partial edit mode. Only the folder and favorite controls are available.
   */
  get partialEdit(): boolean {
    return this.config.mode === "partial-edit";
  }

  get organizationDataOwnershipDisabled() {
    return this.config.organizationDataOwnershipDisabled;
  }

  get collections(): CollectionView[] {
    return this.config.collections;
  }

  get initialValues(): OptionalInitialValues | undefined {
    return this.config.initialValues;
  }

  /**
   * Show the organization data ownership option in the Owner dropdown when:
   * 1. organization data ownership disabled policy IS NOT enabled
   * 2. `organizationId` control is disabled
   * 3. organization data ownership disabled policy IS enabled
   * AND they're editing a cipher that is not currently owned by an organization
   *
   * This avoids the scenario where the dropdown is empty because the user personally
   * owns the cipher but cannot edit the ownership.
   */
  get showOrganizationDataOwnershipOption() {
    return (
      this.organizationDataOwnershipDisabled ||
      this.itemDetailsForm.controls.organizationId.disabled ||
      (!this.organizationDataOwnershipDisabled &&
        this.config.originalCipher &&
        this.itemDetailsForm.controls.organizationId.value === null)
    );
  }

  constructor(
    private cipherFormContainer: CipherFormContainer,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private destroyRef: DestroyRef,
    private accountService: AccountService,
    private configService: ConfigService,
    private policyService: PolicyService,
  ) {
    this.cipherFormContainer.registerChildForm("itemDetails", this.itemDetailsForm);
    this.itemDetailsForm.valueChanges
      .pipe(
        takeUntilDestroyed(),
        // getRawValue() because organizationId can be disabled for edit mode
        map(() => this.itemDetailsForm.getRawValue()),
      )
      .subscribe((value) => {
        this.cipherFormContainer.patchCipher((cipher) => {
          Object.assign(cipher, {
            name: value.name,
            organizationId: value.organizationId,
            folderId: value.folderId,
            collectionIds: [
              ...(value.collectionIds?.map((c) => c.id) || []),
              ...this.readOnlyCollections.map((c) => c.id),
            ],
            favorite: value.favorite,
          } as CipherView);
          return cipher;
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
    // Do not allow ownership change in edit mode and the cipher is owned by an organization
    if (this.config.mode === "edit" && this.originalCipherView?.organizationId != null) {
      return false;
    }

    // If personal ownership is allowed and there is at least one organization, allow ownership change.
    if (this.organizationDataOwnershipDisabled) {
      return this.organizations.length > 0;
    }

    // Personal ownership is not allowed, only allow ownership change if there is more than one organization.
    return this.organizations.length > 1;
  }

  get showOwnership() {
    // Show ownership field when editing with available orgs
    const isEditingWithOrgs = this.organizations.length > 0 && this.config.mode === "edit";

    // When in admin console, ownership should not be shown unless cloning
    const isAdminConsoleEdit = this.config.isAdminConsole && this.config.mode !== "clone";

    return this.allowOwnershipChange || (isEditingWithOrgs && !isAdminConsoleEdit);
  }

  get defaultOwner() {
    return this.organizationDataOwnershipDisabled ? null : this.organizations[0].id;
  }

  async ngOnInit() {
    this.organizations = this.config.organizations.sort(
      Utils.getSortFunction(this.i18nService, "name"),
    );

    this.userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    if (!this.organizationDataOwnershipDisabled && this.organizations.length === 0) {
      throw new Error("No organizations available for ownership.");
    }

    const prefillCipher = this.cipherFormContainer.getInitialCipherView();

    if (prefillCipher) {
      await this.initFromExistingCipher(prefillCipher);
    } else {
      const orgId = this.initialValues?.organizationId;
      this.itemDetailsForm.setValue({
        name: this.initialValues?.name || "",
        organizationId: orgId || this.defaultOwner,
        folderId: this.initialValues?.folderId || null,
        collectionIds: [],
        favorite: false,
      });
      await this.updateCollectionOptions(this.initialValues?.collectionIds);
    }
    this.setFormStatus();
    if (!this.allowOwnershipChange) {
      this.itemDetailsForm.controls.organizationId.disable();
    }
    this.itemDetailsForm.controls.organizationId.valueChanges
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        concatMap(async (orgId) => {
          await this.updateCollectionOptions();
          this.setFormStatus();
        }),
      )
      .subscribe();
  }

  /**
   * When the cipher does not belong to an organization but the user's organization
   * requires all ciphers to be owned by an organization, disable the entire form
   * until the user selects an organization.
   */
  private setFormStatus() {
    if (this.config.originalCipher && !this.organizationDataOwnershipDisabled) {
      if (this.itemDetailsForm.controls.organizationId.value === null) {
        this.cipherForm.disable({ emitEvent: false });
        this.itemDetailsForm.controls.organizationId.enable();
      } else {
        this.cipherForm.enable({ emitEvent: false });
      }
    }
  }

  /**
   * Gets the default collection IDs for the selected organization.
   * Returns null if any of the following apply:
   * - the feature flag is disabled
   * - the "no private data policy" doesn't apply to the user
   * - no org is currently selected
   * - the selected org doesn't have the "no private data policy" enabled
   */
  private async getDefaultCollectionId(orgId?: OrganizationId) {
    if (!orgId || this.organizationDataOwnershipDisabled) {
      return;
    }

    const isFeatureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.CreateDefaultLocation,
    );

    if (!isFeatureEnabled) {
      return;
    }

    const selectedOrgHasPolicyEnabled = (
      await firstValueFrom(
        this.policyService.policiesByType$(PolicyType.OrganizationDataOwnership, this.userId),
      )
    ).find((p) => p.organizationId);

    if (!selectedOrgHasPolicyEnabled) {
      return;
    }

    const defaultUserCollection = this.collections.find(
      (c) => c.organizationId === orgId && c.type === CollectionTypes.DefaultUserCollection,
    );
    // If the user was added after the policy was enabled as they will not have any private data
    // and will not have a default collection.
    return defaultUserCollection?.id;
  }

  private async initFromExistingCipher(prefillCipher: CipherView) {
    const { name, folderId, collectionIds } = prefillCipher;

    this.itemDetailsForm.setValue({
      name: name ? name : (this.initialValues?.name ?? ""),
      organizationId: prefillCipher.organizationId, // We do not allow changing ownership of an existing cipher.
      folderId: folderId ? folderId : (this.initialValues?.folderId ?? null),
      collectionIds: [],
      favorite: prefillCipher.favorite,
    });

    const orgId = this.itemDetailsForm.controls.organizationId.value as OrganizationId;
    const organization = this.organizations.find((o) => o.id === orgId);
    const initializedWithCachedCipher = this.cipherFormContainer.initializedWithCachedCipher();

    // Configure form for clone mode.
    if (this.config.mode === "clone") {
      if (!initializedWithCachedCipher) {
        this.itemDetailsForm.controls.name.setValue(
          prefillCipher.name + " - " + this.i18nService.t("clone"),
        );
      }

      if (!this.organizationDataOwnershipDisabled && prefillCipher.organizationId == null) {
        this.itemDetailsForm.controls.organizationId.setValue(this.defaultOwner);
      }
    }

    const prefillCollections = collectionIds?.length
      ? (collectionIds as CollectionId[])
      : (this.initialValues?.collectionIds ?? []);

    await this.updateCollectionOptions(prefillCollections);

    if (!organization?.canEditAllCiphers && !prefillCipher.canAssignToCollections) {
      this.itemDetailsForm.controls.collectionIds.disable();
    }

    if (this.partialEdit) {
      this.itemDetailsForm.disable();
      this.itemDetailsForm.controls.favorite.enable();
      this.itemDetailsForm.controls.folderId.enable();
    } else if (this.config.mode === "edit") {
      if (!this.config.isAdminConsole || !this.config.admin) {
        this.readOnlyCollections = this.collections.filter(
          // When the configuration is set up for admins, they can alter read only collections
          (c) =>
            c.organizationId === orgId &&
            c.readOnly &&
            this.originalCipherView.collectionIds.includes(c.id as CollectionId),
        );

        // When Owners/Admins access setting is turned on.
        // Disable Collections Options if Owner/Admin does not have Edit/Manage permissions on item
        // Disable Collections Options if Custom user does not have Edit/Manage permissions on item
        if (
          (organization?.allowAdminAccessToAllCollectionItems &&
            (!this.originalCipherView.viewPassword || !this.originalCipherView.edit)) ||
          (organization?.type === OrganizationUserType.Custom &&
            !this.originalCipherView.viewPassword)
        ) {
          this.itemDetailsForm.controls.collectionIds.disable();
        }
      }
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
    } else {
      collectionsControl.enable();
      this.showCollectionsControl = true;
    }

    this.collectionOptions = this.collections
      .filter((c) => {
        // The collection belongs to the organization
        if (c.organizationId !== orgId) {
          return false;
        }

        // When in partial edit mode, show all org collections because the control is disabled.
        if (this.partialEdit) {
          return true;
        }

        // When viewing as an admin, all collections should be shown, even readonly. (AC Only)
        if (this.config.admin) {
          return true;
        }

        // Non-admins can only select assigned collections that are not read only. (Non-AC)
        return c.assigned && !c.readOnly;
      })
      .sort((a, b) => {
        const aIsDefaultCollection = a.type === CollectionTypes.DefaultUserCollection ? -1 : 0;
        const bIsDefaultCollection = b.type === CollectionTypes.DefaultUserCollection ? -1 : 0;
        return aIsDefaultCollection - bIsDefaultCollection;
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

    if (startingSelection.filter(Boolean).length > 0) {
      collectionsControl.setValue(
        this.collectionOptions.filter((c) => startingSelection.includes(c.id as CollectionId)),
      );
    } else {
      const defaultCollectionId = await this.getDefaultCollectionId(orgId);
      if (defaultCollectionId) {
        collectionsControl.setValue(
          this.collectionOptions.filter((c) => c.id === defaultCollectionId),
        );
      }
    }
  }
}
