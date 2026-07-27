import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  WritableSignal,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { AbstractControl, FormBuilder, Validators } from "@angular/forms";
import {
  combineLatest,
  distinctUntilChanged,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
  tap,
  filter,
  take,
} from "rxjs";

import {
  CollectionAdminService,
  OrganizationUserApiService,
  OrganizationUserUserMiniResponse,
  CollectionService,
} from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  CollectionAccessSelectionView,
  CollectionAdminView,
  CollectionView,
  CollectionResponse,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { getById } from "@bitwarden/common/platform/misc";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  SelectModule,
  BitValidators,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { Vfo1IconPipe } from "@bitwarden/vault";

import { openChangePlanDialog } from "../../../../../billing/organizations/change-plan-dialog.component";
import { SharedModule } from "../../../../../shared";
import { GroupApiService, GroupView } from "../../../core";
import { freeOrgCollectionLimitValidator } from "../../validators/free-org-collection-limit.validator";
import { PermissionMode } from "../access-selector/access-selector.component";
import {
  AccessItemType,
  AccessItemValue,
  AccessItemView,
  CollectionPermission,
  convertToPermission,
  convertToSelectionView,
} from "../access-selector/access-selector.models";
import { AccessSelectorModule } from "../access-selector/access-selector.module";

import {
  CollectionDialogAction,
  CollectionDialogParams,
  CollectionDialogResult,
  CollectionDialogTabType,
} from "./collection-dialog.models";

const ButtonType = Object.freeze({
  /** Displayed when the user has reached the maximum number of collections allowed for the organization. */
  Upgrade: "upgrade",
  /** Displayed when the user can still add more collections within the allowed limit. */
  Save: "save",
} as const);
type ButtonType = (typeof ButtonType)[keyof typeof ButtonType];

@Component({
  selector: "app-collection-dialog",
  templateUrl: "collection-dialog.component.html",
  imports: [SharedModule, AccessSelectorModule, SelectModule, Vfo1IconPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionDialogComponent implements OnInit {
  private readonly params = inject<CollectionDialogParams>(DIALOG_DATA);
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef = inject<DialogRef<CollectionDialogResult>>(DialogRef);
  private readonly organizationService = inject(OrganizationService);
  private readonly groupService = inject(GroupApiService);
  private readonly collectionAdminService = inject(CollectionAdminService);
  private readonly i18nService = inject(I18nService);
  private readonly organizationUserApiService = inject(OrganizationUserApiService);
  private readonly dialogService = inject(DialogService);
  private readonly accountService = inject(AccountService);
  private readonly toastService = inject(ToastService);
  private readonly collectionService = inject(CollectionService);
  private readonly configService = inject(ConfigService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly formGroup = this.formBuilder.group({
    name: ["", [Validators.required, BitValidators.forbiddenCharacters(["/"])]],
    // set to readonly in the template
    externalId: { value: "", disabled: false },
    parent: undefined as string | undefined,
    access: [[] as AccessItemValue[]],
    selectedOrg: "" as OrganizationId,
  });

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  protected readonly organizations$: Observable<Organization[]> = this.activeUserId$.pipe(
    switchMap((userId) => this.organizationService.organizations$(userId)),
    map((orgs) =>
      orgs
        .filter((o) => o.canCreateNewCollections && !o.isProviderUser)
        .sort(Utils.getSortFunction(this.i18nService, "name")),
    ),
  );

  private readonly selectedOrgId$ = this.formGroup.controls.selectedOrg.valueChanges.pipe(
    startWith(this.params.organizationId),
    distinctUntilChanged(),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  protected readonly organization$ = this.selectedOrgId$.pipe(
    switchMap((orgId) =>
      orgId
        ? this.activeUserId$.pipe(
            switchMap((userId) => this.organizationService.organizations$(userId)),
            map((orgs) => orgs.find((o) => o.id === orgId)),
          )
        : of(undefined),
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  protected readonly organization = toSignal(this.organization$);

  private readonly allCollections$ = this.selectedOrgId$.pipe(
    switchMap((orgId) =>
      orgId
        ? this.activeUserId$.pipe(
            switchMap((userId) => this.collectionAdminService.collectionAdminViews$(orgId, userId)),
          )
        : of([]),
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  protected readonly collection$ = this.allCollections$.pipe(
    map((collections) => {
      if (!this.params.collectionId) {
        return undefined;
      }
      const found = collections.find((c) => c.id === this.params.collectionId);
      if (!found) {
        throw new Error("Could not find collection to edit.");
      }
      return found;
    }),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  protected readonly collection = toSignal(this.collection$);

  private readonly groups$ = this.organization$.pipe(
    switchMap((organization) =>
      organization?.useGroups && organization.id
        ? this.groupService.getAll(organization.id)
        : of([] as GroupView[]),
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  private readonly users$ = this.selectedOrgId$.pipe(
    switchMap((orgId) =>
      orgId ? this.organizationUserApiService.getAllMiniUserDetails(orgId) : of({ data: [] }),
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  protected readonly accessItems$ = combineLatest([
    this.groups$,
    this.users$,
    this.collection$,
  ]).pipe(
    map(([groups, users, collection]) =>
      ([] as AccessItemView[]).concat(
        groups.map((group) => mapGroupToAccessItemView(group, collection)),
        users.data.map((user) => mapUserToAccessItemView(user, collection)),
      ),
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  private readonly nestOptionsState$ = combineLatest({
    allCollections: this.allCollections$,
    collection: this.collection$,
    organization: this.organization$,
  }).pipe(
    map(({ allCollections, collection, organization }) => {
      let nestOptions: CollectionView[] = this.params.limitNestedCollections
        ? allCollections.filter((c) => c.manage)
        : allCollections;

      let deletedParentName: string | undefined = undefined;

      if (collection) {
        nestOptions = nestOptions.filter((c) => c.id !== this.params.collectionId);

        const { parent: parentName } = parseName(collection);

        if (parentName !== undefined) {
          if (
            organization?.canViewAllCollections &&
            !allCollections.find((c) => c.name === parentName)
          ) {
            deletedParentName = parentName;
          } else if (!nestOptions.find((c) => c.name === parentName)) {
            nestOptions = [{ name: parentName } as CollectionView, ...nestOptions];
          }
        }
      }

      return { nestOptions, deletedParentName };
    }),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  protected readonly nestOptions = toSignal(
    this.nestOptionsState$.pipe(map((s) => s.nestOptions)),
    { initialValue: [] as CollectionView[] },
  );

  protected readonly deletedParentName = toSignal(
    this.nestOptionsState$.pipe(map((s) => s.deletedParentName)),
  );

  protected readonly tabIndex: WritableSignal<number> = signal(
    this.params.initialTab ?? CollectionDialogTabType.Info,
  );

  protected readonly showDeleteButton = toSignal(
    combineLatest([this.collection$, this.organization$]).pipe(
      map(
        ([collection, organization]) =>
          !this.dialogReadonly &&
          !!collection &&
          !!organization &&
          collection.canDelete(organization),
      ),
    ),
    { initialValue: false },
  );

  protected readonly buttonDisplayName$ = this.formGroup.controls.selectedOrg.statusChanges.pipe(
    startWith(null),
    map(() =>
      this.formGroup.controls.selectedOrg.errors?.cannotCreateCollections
        ? ButtonType.Upgrade
        : ButtonType.Save,
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  protected readonly initialPermission = signal(
    this.params.initialPermission ?? CollectionPermission.View,
  );

  protected readonly btnTextAddCreateFeatureFlag = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM32380_BtnTextAddCreate),
  );

  private readonly orgExceedingCollectionLimit$ = this.organizationSelected.statusChanges.pipe(
    filter(() => !!this.organizationSelected.errors?.cannotCreateCollections),
    switchMap(() =>
      this.organizations$.pipe(getById(this.organizationSelected.value as OrganizationId)),
    ),
    tap(() => {
      this.organizationSelected.markAsTouched();
      this.formGroup.updateValueAndValidity();
    }),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  private readonly orgExceedingCollectionLimit = toSignal(this.orgExceedingCollectionLimit$);

  protected readonly loading = toSignal(this.accessItems$.pipe(map(() => false)), {
    initialValue: true,
  });

  protected readonly showAddAccessWarning = toSignal(
    this.organization$.pipe(
      map(
        (org) => !org?.allowAdminAccessToAllCollectionItems && !!this.params.isAddAccessCollection,
      ),
    ),
    { initialValue: false },
  );

  protected readonly showOrgSelector = signal(false);

  protected readonly PermissionMode = PermissionMode;

  async ngOnInit() {
    const userId = await firstValueFrom(this.activeUserId$);
    if (this.params.showOrgSelector) {
      this.showOrgSelector.set(true);
    }

    this.formGroup.patchValue({ selectedOrg: this.params.organizationId }, { emitEvent: false });

    this.organizationSelected.setAsyncValidators(
      freeOrgCollectionLimitValidator(
        this.organizations$,
        this.collectionService
          .encryptedCollections$(userId)
          .pipe(map((collections) => collections ?? [])),
        this.i18nService,
      ),
    );

    this.formGroup.updateValueAndValidity();

    this.organization$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((organization) => {
      if (!organization) {
        return;
      }
      if (!organization.allowAdminAccessToAllCollectionItems) {
        this.formGroup.controls.access.addValidators(validateCanManagePermission);
      } else {
        this.formGroup.controls.access.removeValidators(validateCanManagePermission);
      }
      this.formGroup.controls.access.updateValueAndValidity();
    });

    combineLatest([this.collection$, this.organization$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.handleFormGroupReadonly(this.dialogReadonly));

    this.selectedOrgId$
      .pipe(
        switchMap(() =>
          combineLatest({
            organization: this.organization$,
            collection: this.collection$,
            allCollections: this.allCollections$,
            users: this.users$,
          }).pipe(take(1)),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ organization, collection, allCollections, users }) => {
        if (!organization) {
          return;
        }

        if (collection) {
          const { name, parent: parentName } = parseName(collection);
          this.formGroup.patchValue({
            name,
            externalId: collection.externalId,
            parent: parentName,
            access: mapToAccessSelections(collection),
          });
        } else {
          const nestOptions: CollectionView[] = this.params.limitNestedCollections
            ? allCollections.filter((c) => c.manage)
            : allCollections;
          const parent = nestOptions.find((c) => c.id === this.params.parentCollectionId);
          const currentOrgUserId = users.data.find((u) => u.userId === organization.userId)?.id;
          const initialSelection: AccessItemValue[] =
            currentOrgUserId !== undefined
              ? [
                  {
                    id: currentOrgUserId,
                    type: AccessItemType.Member,
                    permission: CollectionPermission.Manage,
                  },
                ]
              : [];

          this.formGroup.patchValue({
            parent: parent?.name ?? undefined,
            access: initialSelection,
          });
        }
      });
  }

  get organizationSelected() {
    return this.formGroup.controls.selectedOrg;
  }

  protected get isExternalIdVisible(): boolean {
    return !!this.params.isAdminConsoleActive && !!this.formGroup.get("externalId")?.value;
  }

  protected get collectionId() {
    return this.params.collectionId;
  }

  protected get editMode() {
    return this.params.collectionId != undefined;
  }

  protected get dialogReadonly() {
    return this.params.readonly === true;
  }

  protected get accessTabLabel(): string {
    return this.dialogReadonly
      ? this.i18nService.t("viewAccess")
      : this.i18nService.t("editAccess");
  }

  protected async cancel() {
    this.close(CollectionDialogAction.Canceled);
  }

  protected readonly submit = async () => {
    // Saving a collection is prohibited while in read only mode
    if (this.dialogReadonly) {
      return;
    }

    this.formGroup.markAllAsTouched();

    if (this.organizationSelected.errors?.cannotCreateCollections) {
      this.close(CollectionDialogAction.Upgrade);
      const org = this.orgExceedingCollectionLimit();
      if (org !== undefined) {
        this.changePlan(org);
      }
      return;
    }

    if (this.formGroup.invalid) {
      const accessTabError = this.formGroup.controls.access.hasError("managePermissionRequired");

      if (this.tabIndex() === CollectionDialogTabType.Access && !accessTabError) {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t(
            "fieldOnTabRequiresAttention",
            this.i18nService.t("collectionInfo"),
          ),
        });
      } else if (this.tabIndex() === CollectionDialogTabType.Info && accessTabError) {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("fieldOnTabRequiresAttention", this.i18nService.t("access")),
        });
      }
      return;
    }
    const collection = this.collection();
    if (
      this.editMode &&
      this.organization() !== undefined &&
      !collection?.canEditName(this.organization()!) &&
      this.formGroup.controls.name.dirty
    ) {
      throw new Error("Cannot change readonly field: Name");
    }

    const parent = this.formGroup.controls.parent?.value;

    // Clone the current collection
    const collectionView = Object.assign(
      new CollectionAdminView({
        id: "" as CollectionId,
        organizationId: "" as OrganizationId,
        name: "",
      }),
      collection,
    );

    collectionView.name = parent
      ? `${parent}/${this.formGroup.controls.name.value ?? ""}`
      : (this.formGroup.controls.name.value ?? "");
    collectionView.id = this.params.collectionId as CollectionId;
    collectionView.organizationId =
      this.formGroup.controls.selectedOrg.value ?? ("" as OrganizationId);
    collectionView.externalId = this.formGroup.controls.externalId.value ?? undefined;
    const accessValue = this.formGroup.controls.access.value ?? [];
    collectionView.groups = accessValue
      .filter((v) => v.type === AccessItemType.Group)
      .map(convertToSelectionView);
    collectionView.users = accessValue
      .filter((v) => v.type === AccessItemType.Member)
      .map(convertToSelectionView);

    const userId = await firstValueFrom(this.activeUserId$);

    const collectionResponse = this.editMode
      ? await this.collectionAdminService.update(collectionView, userId)
      : await this.collectionAdminService.create(collectionView, userId);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t(
        this.editMode ? "editedCollectionId" : "createdCollectionId",
        collectionView.name,
      ),
    });

    this.close(CollectionDialogAction.Saved, collectionResponse);
  };

  protected readonly delete = async () => {
    // Deleting a collection is prohibited while in read only mode
    if (this.dialogReadonly) {
      return;
    }

    const collection = this.collection();
    const confirmed = await this.dialogService.openSimpleDialog({
      title: collection?.name ?? "",
      content: { key: "deleteCollectionConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    if (this.params.collectionId !== undefined) {
      await this.collectionAdminService.delete(
        this.params.organizationId,
        this.params.collectionId,
      );
    }

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("deletedCollectionId", collection?.name),
    });

    this.close(CollectionDialogAction.Deleted, collection);
  };

  private changePlan(org: Organization) {
    openChangePlanDialog(this.dialogService, {
      data: {
        organizationId: org.id,
        subscription: undefined,
        productTierType: org.productTierType,
      },
    });
  }

  private handleFormGroupReadonly(readonly: boolean) {
    if (readonly) {
      this.formGroup.controls.access.disable();
      this.formGroup.controls.name.disable();
      this.formGroup.controls.parent.disable();
      return;
    }

    this.formGroup.controls.access.enable();

    if (!this.editMode) {
      this.formGroup.controls.name.enable();
      this.formGroup.controls.parent.enable();
      return;
    }

    const collection = this.collection();
    if (!collection || !this.organization()) {
      return;
    }
    const canEditName = collection.canEditName(this.organization()!);
    this.formGroup.controls.name[canEditName ? "enable" : "disable"]();
    this.formGroup.controls.parent[canEditName ? "enable" : "disable"]();
  }

  private close(action: CollectionDialogAction, collection?: CollectionResponse | CollectionView) {
    void this.dialogRef.close({ action, collection } as CollectionDialogResult);
  }
}

function parseName(collection: CollectionView) {
  const nameParts = collection.name.split("/");
  const name = nameParts[nameParts.length - 1];
  const parent = nameParts.length > 1 ? nameParts.slice(0, -1).join("/") : undefined;

  return { name, parent };
}

function mapToAccessSelections(
  collectionDetails: CollectionAdminView | undefined,
): AccessItemValue[] {
  if (collectionDetails === undefined) {
    return [];
  }
  return ([] as AccessItemValue[]).concat(
    collectionDetails.groups.map<AccessItemValue>((selection) => ({
      id: selection.id,
      type: AccessItemType.Group,
      permission: convertToPermission(selection),
    })),
    collectionDetails.users.map<AccessItemValue>((selection) => ({
      id: selection.id,
      type: AccessItemType.Member,
      permission: convertToPermission(selection),
    })),
  );
}

/**
 * Validator to ensure that at least one access item has Manage permission
 */
function validateCanManagePermission(control: AbstractControl) {
  const access = control.value as AccessItemValue[];
  const hasManagePermission = access.some((a) => a.permission === CollectionPermission.Manage);

  return hasManagePermission ? null : { managePermissionRequired: true };
}

/**
 *
 * @param group Current group being used to translate object into AccessItemView
 * @param collectionId Current collection being viewed/edited
 * @returns AccessItemView customized to set a readonlyPermission to be displayed if the access selector is in a disabled state
 */
function mapGroupToAccessItemView(
  group: GroupView,
  collection: CollectionAdminView | undefined,
): AccessItemView {
  return {
    id: group.id,
    type: AccessItemType.Group,
    listName: group.name,
    labelName: group.name,
    readonly: false,
    readonlyPermission:
      collection != null
        ? convertToPermission(collection.groups.find((g) => g.id === group.id))
        : undefined,
  };
}

/**
 *
 * @param user Current user being used to translate object into AccessItemView
 * @param collectionId Current collection being viewed/edited
 * @returns AccessItemView customized to set a readonlyPermission to be displayed if the access selector is in a disabled state
 */
function mapUserToAccessItemView(
  user: OrganizationUserUserMiniResponse,
  collection: CollectionAdminView | undefined,
): AccessItemView {
  return {
    id: user.id,
    type: AccessItemType.Member,
    email: user.email,
    role: user.type,
    listName: user.name?.length > 0 ? `${user.name} (${user.email})` : user.email,
    labelName: user.name ?? user.email,
    status: user.status,
    readonly: false,
    readonlyPermission:
      collection != null
        ? convertToPermission(
            new CollectionAccessSelectionView(collection.users.find((u) => u.id === user.id)),
          )
        : undefined,
  };
}

/**
 * Strongly typed helper to open a CollectionDialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export function openCollectionDialog(
  dialogService: DialogService,
  config: DialogConfig<CollectionDialogParams, CollectionDialogResult>,
) {
  return dialogService.open<CollectionDialogResult>(CollectionDialogComponent, config);
}
