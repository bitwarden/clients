import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import {
  Observable,
  Subject,
  combineLatest,
  map,
  shareReplay,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PluralizePipe } from "@bitwarden/angular/pipes/pluralize.pipe";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import {
  AsyncActionsModule,
  BitSubmitDirective,
  ButtonComponent,
  ButtonModule,
  DialogModule,
  FormFieldModule,
  MultiSelectModule,
  SelectItemView,
  SelectModule,
  ToastService,
} from "@bitwarden/components";

export interface CollectionAssignmentParams {
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

export enum CollectionAssignmentResult {
  Saved = "saved",
  Canceled = "canceled",
}

@Component({
  selector: "assign-collections",
  templateUrl: "assign-collections.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    FormFieldModule,
    AsyncActionsModule,
    MultiSelectModule,
    SelectModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
  ],
})
export class AssignCollectionsComponent implements OnInit {
  @ViewChild(BitSubmitDirective)
  private bitSubmit: BitSubmitDirective;

  @Input() params: CollectionAssignmentParams;

  /**
   * Submit button instance that will be disabled or marked as loading when the form is submitting.
   */
  @Input() submitBtn?: ButtonComponent;

  @Output()
  editableItemCountChange = new EventEmitter<number>();

  @Output() onCollectionAssign = new EventEmitter<CollectionAssignmentResult>();

  formGroup = this.formBuilder.group({
    selectedOrg: [null],
    collections: [<SelectItemView[]>[], [Validators.required]],
  });

  protected totalItemCount: number;
  protected editableItemCount: number;
  protected readonlyItemCount: number;
  protected personalItemsCount: number;
  protected availableCollections: SelectItemView[] = [];
  protected orgName: string;
  protected showOrgSelector: boolean = false;

  protected organizations$: Observable<Organization[]> =
    this.organizationService.organizations$.pipe(
      map((orgs) =>
        orgs
          .filter((o) => o.enabled && o.status === OrganizationUserStatusType.Confirmed)
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
      tap((orgs) => {
        if (orgs.length > 0 && this.showOrgSelector) {
          // Using setTimeout to defer the patchValue call until the next event loop cycle
          setTimeout(() => {
            this.formGroup.patchValue({ selectedOrg: orgs[0].id });
            this.setFormValidators();
          });
        }
      }),
    );

  protected transferWarningText = (orgName: string, itemsCount: number) => {
    const pluralizedItems = this.pluralizePipe.transform(itemsCount, "item", "items");
    return orgName
      ? this.i18nService.t("personalItemsWithOrgTransferWarning", pluralizedItems, orgName)
      : this.i18nService.t("personalItemsTransferWarning", pluralizedItems);
  };

  private editableItems: CipherView[] = [];
  private get selectedOrgId(): OrganizationId {
    return this.formGroup.value.selectedOrg;
  }
  private destroy$ = new Subject<void>();

  constructor(
    private cipherService: CipherService,
    private i18nService: I18nService,
    private configService: ConfigService,
    private organizationService: OrganizationService,
    private collectionService: CollectionService,
    private formBuilder: FormBuilder,
    private pluralizePipe: PluralizePipe,
    private toastService: ToastService,
  ) {}

  async ngOnInit() {
    const v1FCEnabled = await this.configService.getFeatureFlag(FeatureFlag.FlexibleCollectionsV1);
    const restrictProviderAccess = await this.configService.getFeatureFlag(
      FeatureFlag.RestrictProviderAccess,
    );

    const onlyPersonalItems = this.params.ciphers.every((c) => c.organizationId == null);

    if (this.params.organizationId === "MyVault" || onlyPersonalItems) {
      this.showOrgSelector = true;
    }

    await this.initializeItems(this.params.organizationId, v1FCEnabled, restrictProviderAccess);

    if (this.params.organizationId && this.params.organizationId !== "MyVault") {
      await this.handleOrganizationCiphers();
    }

    this.setupFormSubscriptions(v1FCEnabled, restrictProviderAccess);
  }

  ngAfterViewInit(): void {
    this.bitSubmit.loading$.pipe(takeUntil(this.destroy$)).subscribe((loading) => {
      if (!this.submitBtn) {
        return;
      }

      this.submitBtn.loading = loading;
    });

    this.bitSubmit.disabled$.pipe(takeUntil(this.destroy$)).subscribe((disabled) => {
      if (!this.submitBtn) {
        return;
      }

      this.submitBtn.disabled = disabled;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectCollections(items: SelectItemView[]) {
    const currentCollections = this.formGroup.controls.collections.value as SelectItemView[];
    const updatedCollections = [...currentCollections, ...items].sort(this.sortItems);
    this.formGroup.patchValue({ collections: updatedCollections });
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    // Retrieve ciphers that belong to an organization
    const cipherIds = this.editableItems
      .filter((i) => i.organizationId)
      .map((i) => i.id as CipherId);

    // Move personal items to the organization
    if (this.personalItemsCount > 0) {
      await this.moveToOrganization(
        this.selectedOrgId,
        this.params.ciphers.filter((c) => c.organizationId == null),
        this.formGroup.controls.collections.value.map((i) => i.id as CollectionId),
      );
    }

    if (cipherIds.length > 0) {
      await (cipherIds.length === 1
        ? this.updateAssignedCollections(this.editableItems[0])
        : this.bulkUpdateCollections(cipherIds));
    }

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("successfullyAssignedCollections"),
    });

    this.onCollectionAssign.emit(CollectionAssignmentResult.Saved);
  };

  private sortItems = (a: SelectItemView, b: SelectItemView) =>
    this.i18nService.collator.compare(a.labelName, b.labelName);

  private async handleOrganizationCiphers() {
    // If no ciphers are editable, cancel the operation
    if (this.editableItemCount == 0) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("nothingSelected"),
      });
      this.onCollectionAssign.emit(CollectionAssignmentResult.Canceled);

      return;
    }

    this.availableCollections = this.params.availableCollections.map((c) => ({
      icon: "bwi-collection",
      id: c.id,
      labelName: c.name,
      listName: c.name,
    }));

    // Select assigned collections for a single cipher.
    this.selectCollectionsAssignedToSingleCipher();

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

  /**
   * Selects the collections that are assigned to a single cipher,
   * excluding the active collection.
   */
  private selectCollectionsAssignedToSingleCipher() {
    if (this.params.ciphers.length !== 1) {
      return;
    }

    const assignedCollectionIds = this.params.ciphers[0].collectionIds;

    // Filter the available collections to select only those that are associated with the ciphers, excluding the active collection
    const assignedCollections = this.availableCollections
      .filter(
        (collection) =>
          assignedCollectionIds.includes(collection.id) &&
          collection.id !== this.params.activeCollection?.id,
      )
      .map((collection) => ({
        icon: "bwi-collection",
        id: collection.id,
        labelName: collection.labelName,
        listName: collection.listName,
      }));

    if (assignedCollections.length > 0) {
      this.selectCollections(assignedCollections);
    }
  }

  private async initializeItems(
    organizationId: OrganizationId,
    v1FCEnabled: boolean,
    restrictProviderAccess: boolean,
  ) {
    this.totalItemCount = this.params.ciphers.length;

    // If organizationId is not present, then all ciphers are considered personal items
    if (!organizationId) {
      this.editableItems = this.params.ciphers;
      this.editableItemCount = this.params.ciphers.length;
      this.personalItemsCount = this.params.ciphers.length;
      this.editableItemCountChange.emit(this.editableItemCount);
      return;
    }

    const org = await this.organizationService.get(organizationId);
    this.orgName = org.name;

    this.editableItems = org.canEditAllCiphers(v1FCEnabled, restrictProviderAccess)
      ? this.params.ciphers
      : this.params.ciphers.filter((c) => c.edit);

    this.editableItemCount = this.editableItems.length;
    // TODO: https://bitwarden.atlassian.net/browse/PM-9307,
    // clean up editableItemCountChange when the org vault is updated to filter editable ciphers
    this.editableItemCountChange.emit(this.editableItemCount);
    this.personalItemsCount = this.params.ciphers.filter((c) => c.organizationId == null).length;
    this.readonlyItemCount = this.totalItemCount - this.editableItemCount;
  }

  private setFormValidators() {
    const selectedOrgControl = this.formGroup.get("selectedOrg");
    selectedOrgControl?.setValidators([Validators.required]);
    selectedOrgControl?.updateValueAndValidity();
  }

  /**
   * Sets up form subscriptions for selected organizations.
   *
   * @param v1FCEnabled - Indicates if flexible collection flag is enabled.
   * @param restrictProviderAccess - Indicates if provider access flag is enabled.
   */
  private setupFormSubscriptions(v1FCEnabled: boolean, restrictProviderAccess: boolean) {
    // Listen to changes in selected organization and update collections
    this.formGroup.controls.selectedOrg.valueChanges
      .pipe(
        tap(() => {
          this.formGroup.controls.collections.setValue([], { emitEvent: false });
        }),
        switchMap((orgId) => {
          return this.getCollectionsForOrganization(
            orgId as OrganizationId,
            v1FCEnabled,
            restrictProviderAccess,
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((collections) => {
        this.availableCollections = collections.map((c) => ({
          icon: "bwi-collection",
          id: c.id,
          labelName: c.name,
          listName: c.name,
        }));
      });
  }

  /**
   * Retrieves the collections for the organization with the given ID.
   * @param orgId
   * @param v1FCEnabled
   * @param restrictProviderAccess
   * @returns An observable of the collections for the organization.
   */
  private getCollectionsForOrganization(
    orgId: OrganizationId,
    v1FCEnabled: boolean,
    restrictProviderAccess: boolean,
  ): Observable<CollectionView[]> {
    return combineLatest([
      this.collectionService.decryptedCollections$,
      this.organizationService.organizations$,
    ]).pipe(
      map(([collections, organizations]) => {
        const org = organizations.find((o) => o.id === orgId);
        this.orgName = org.name;

        return collections.filter((c) => {
          return (
            c.organizationId === orgId && c.canEditItems(org, v1FCEnabled, restrictProviderAccess)
          );
        });
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  private async moveToOrganization(
    organizationId: OrganizationId,
    shareableCiphers: CipherView[],
    selectedCollectionIds: CollectionId[],
  ) {
    await this.cipherService.shareManyWithServer(
      shareableCiphers,
      organizationId,
      selectedCollectionIds,
    );

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t(
        "movedItemsToOrg",
        this.orgName ?? this.i18nService.t("organization"),
      ),
    });
  }

  private async bulkUpdateCollections(cipherIds: CipherId[]) {
    if (this.formGroup.controls.collections.value.length > 0) {
      await this.cipherService.bulkUpdateCollectionsWithServer(
        this.selectedOrgId,
        cipherIds,
        this.formGroup.controls.collections.value.map((i) => i.id as CollectionId),
        false,
      );
    }

    if (
      this.params.activeCollection != null &&
      this.formGroup.controls.collections.value.find(
        (c) => c.id === this.params.activeCollection.id,
      ) == null
    ) {
      await this.cipherService.bulkUpdateCollectionsWithServer(
        this.selectedOrgId,
        cipherIds,
        [this.params.activeCollection.id as CollectionId],
        true,
      );
    }
  }

  private async updateAssignedCollections(cipherView: CipherView) {
    const { collections } = this.formGroup.getRawValue();
    cipherView.collectionIds = collections.map((i) => i.id as CollectionId);
    const cipher = await this.cipherService.encrypt(cipherView);
    await this.cipherService.saveCollectionsWithServer(cipher);
  }
}
