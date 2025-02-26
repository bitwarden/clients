// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import {
  combineLatest,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";

import { CollectionService, CollectionView } from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
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

  /**
   * Flag indicating if the user is performing the action as an admin on a SINGLE cipher. When true,
   * the `/admin` endpoint will be used to update the cipher's collections. Required when updating
   * ciphers an Admin does not normally have access to or for Unassigned ciphers.
   *
   * The bulk method already handles admin actions internally.
   */
  isSingleCipherAdmin?: boolean;
}

export enum CollectionAssignmentResult {
  Saved = "saved",
  Canceled = "canceled",
}

const MY_VAULT_ID = "MyVault";

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
export class AssignCollectionsComponent implements OnInit, OnDestroy, AfterViewInit {
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

  protected organizations$: Observable<Organization[]> = this.accountService.activeAccount$.pipe(
    switchMap((account) =>
      this.organizationService.organizations$(account?.id).pipe(
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

              // Disable the org selector if there is only one organization
              if (orgs.length === 1) {
                this.formGroup.controls.selectedOrg.disable();
              }
            });
          }
        }),
      ),
    ),
  );

  protected transferWarningText = (orgName: string, itemsCount: number) => {
    const haveOrgName = !!orgName;

    if (itemsCount > 1 && haveOrgName) {
      return this.i18nService.t("personalItemsWithOrgTransferWarningPlural", itemsCount, orgName);
    }
    if (itemsCount > 1 && !haveOrgName) {
      return this.i18nService.t("personalItemsTransferWarningPlural", itemsCount);
    }
    if (itemsCount === 1 && haveOrgName) {
      return this.i18nService.t("personalItemWithOrgTransferWarningSingular", orgName);
    }
    return this.i18nService.t("personalItemTransferWarningSingular");
  };

  private editableItems: CipherView[] = [];
  // Get the selected organization ID. If the user has not selected an organization from the form,
  // fallback to use the organization ID from the params.
  private get selectedOrgId(): OrganizationId {
    return this.formGroup.getRawValue().selectedOrg || this.params.organizationId;
  }
  private destroy$ = new Subject<void>();

  constructor(
    private cipherService: CipherService,
    private i18nService: I18nService,
    private organizationService: OrganizationService,
    private collectionService: CollectionService,
    private formBuilder: FormBuilder,
    private toastService: ToastService,
    private accountService: AccountService,
  ) {}

  async ngOnInit() {
    const onlyPersonalItems = this.params.ciphers.every((c) => c.organizationId == null);

    if (this.selectedOrgId === MY_VAULT_ID || onlyPersonalItems) {
      this.showOrgSelector = true;
    }

    await this.initializeItems(this.selectedOrgId);

    if (this.selectedOrgId && this.selectedOrgId !== MY_VAULT_ID) {
      await this.handleOrganizationCiphers(this.selectedOrgId);
    }

    this.setupFormSubscriptions();
  }

  ngAfterViewInit(): void {
    this.bitSubmit.loading$.pipe(takeUntil(this.destroy$)).subscribe((loading) => {
      if (!this.submitBtn) {
        return;
      }

      this.submitBtn.loading.set(loading);
    });

    this.bitSubmit.disabled$.pipe(takeUntil(this.destroy$)).subscribe((disabled) => {
      if (!this.submitBtn) {
        return;
      }

      this.submitBtn.disabled.set(disabled);
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

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    // Move personal items to the organization
    if (this.personalItemsCount > 0) {
      await this.moveToOrganization(
        this.selectedOrgId,
        this.params.ciphers.filter((c) => c.organizationId == null),
        this.formGroup.controls.collections.value.map((i) => i.id as CollectionId),
        activeUserId,
      );
    }

    if (cipherIds.length > 0) {
      const isSingleOrgCipher = cipherIds.length === 1 && this.personalItemsCount === 0;

      // Update assigned collections for single org cipher or bulk update collections for multiple org ciphers
      await (isSingleOrgCipher
        ? this.updateAssignedCollections(this.editableItems[0], activeUserId)
        : this.bulkUpdateCollections(cipherIds, activeUserId));

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("successfullyAssignedCollections"),
      });
    }

    this.onCollectionAssign.emit(CollectionAssignmentResult.Saved);
  };

  private sortItems = (a: SelectItemView, b: SelectItemView) =>
    this.i18nService.collator.compare(a.labelName, b.labelName);

  private async handleOrganizationCiphers(organizationId: OrganizationId) {
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

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const org = await firstValueFrom(
      this.organizationService.organizations$(userId).pipe(getOrganizationById(organizationId)),
    );

    this.availableCollections = this.params.availableCollections
      .filter((collection) => {
        return collection.canEditItems(org);
      })
      .map((c) => ({
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

  private async initializeItems(organizationId: OrganizationId) {
    this.totalItemCount = this.params.ciphers.length;

    // If organizationId is not present or organizationId is MyVault, then all ciphers are considered personal items
    if (!organizationId || organizationId === MY_VAULT_ID) {
      this.editableItems = this.params.ciphers;
      this.editableItemCount = this.params.ciphers.length;
      this.personalItemsCount = this.params.ciphers.length;
      this.editableItemCountChange.emit(this.editableItemCount);
      return;
    }

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const org = await firstValueFrom(
      this.organizationService.organizations$(userId).pipe(getOrganizationById(organizationId)),
    );
    this.orgName = org.name;

    this.editableItems = org.canEditAllCiphers
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
   */
  private setupFormSubscriptions() {
    // Listen to changes in selected organization and update collections
    this.formGroup.controls.selectedOrg.valueChanges
      .pipe(
        tap(() => {
          this.formGroup.controls.collections.setValue([], { emitEvent: false });
        }),
        switchMap((orgId) => {
          return this.getCollectionsForOrganization(orgId as OrganizationId);
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
   * @returns An observable of the collections for the organization.
   */
  private getCollectionsForOrganization(orgId: OrganizationId): Observable<CollectionView[]> {
    return combineLatest([
      this.collectionService.decryptedCollections$,
      this.accountService.activeAccount$.pipe(
        switchMap((account) => this.organizationService.organizations$(account?.id)),
      ),
    ]).pipe(
      map(([collections, organizations]) => {
        const org = organizations.find((o) => o.id === orgId);
        this.orgName = org.name;

        return collections.filter((c) => {
          return c.organizationId === orgId && !c.readOnly;
        });
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  private async moveToOrganization(
    organizationId: OrganizationId,
    shareableCiphers: CipherView[],
    selectedCollectionIds: CollectionId[],
    userId: UserId,
  ) {
    await this.cipherService.shareManyWithServer(
      shareableCiphers,
      organizationId,
      selectedCollectionIds,
      userId,
    );

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t(
        shareableCiphers.length === 1 ? "itemMovedToOrg" : "itemsMovedToOrg",
        this.orgName ?? this.i18nService.t("organization"),
      ),
    });
  }

  private async bulkUpdateCollections(cipherIds: CipherId[], userId: UserId) {
    if (this.formGroup.controls.collections.value.length > 0) {
      await this.cipherService.bulkUpdateCollectionsWithServer(
        this.selectedOrgId,
        userId,
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
        userId,
        cipherIds,
        [this.params.activeCollection.id as CollectionId],
        true,
      );
    }
  }

  private async updateAssignedCollections(cipherView: CipherView, userId: UserId) {
    const { collections } = this.formGroup.getRawValue();
    cipherView.collectionIds = collections.map((i) => i.id as CollectionId);
    const cipher = await this.cipherService.encrypt(cipherView, userId);
    if (this.params.isSingleCipherAdmin) {
      await this.cipherService.saveCollectionsWithServerAdmin(cipher);
    } else {
      await this.cipherService.saveCollectionsWithServer(cipher, userId);
    }
  }
}
