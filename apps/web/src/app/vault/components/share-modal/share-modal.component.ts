import { Component, Inject, OnInit, OnDestroy, ChangeDetectorRef } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { firstValueFrom, Subject, map } from "rxjs";

import {
  CollectionAdminService,
  CollectionAdminView,
  OrganizationUserApiService,
  OrganizationUserUserMiniResponse,
} from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  DialogModule,
  ToastService,
} from "@bitwarden/components";

import { GroupApiService, GroupView } from "../../../admin-console/organizations/core";
import { PermissionMode } from "../../../admin-console/organizations/shared/components/access-selector/access-selector.component";
import {
  AccessItemView,
  AccessItemValue,
  AccessItemType,
  CollectionPermission,
  convertToSelectionView,
} from "../../../admin-console/organizations/shared/components/access-selector/access-selector.models";
import { AccessSelectorModule } from "../../../admin-console/organizations/shared/components/access-selector/access-selector.module";
import { SharedModule } from "../../../shared";

export interface ShareModalParams {
  cipher: CipherViewLike;
}

export interface ShareModalResult {
  action: "shared" | "canceled";
}

interface PermissionSet {
  users: Map<string, CollectionPermission>;
  groups: Map<string, CollectionPermission>;
}

@Component({
  selector: "app-share-modal",
  templateUrl: "share-modal.component.html",
  standalone: true,
  imports: [SharedModule, DialogModule, AccessSelectorModule],
})
export class ShareModalComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  cipher: CipherViewLike;
  organization?: Organization;
  accessItems: AccessItemView[] = [];
  currentUser?: OrganizationUserUserMiniResponse;
  existingCollections: CollectionAdminView[] = [];
  loading = true;
  submitting = false;
  shareableLink = "";
  sharingComplete = false;
  createdCollectionId = "";
  showExistingCollectionStep = false;
  existingCollection?: CollectionAdminView;

  protected PermissionMode = PermissionMode;

  protected formGroup = this.formBuilder.group({
    collectionName: [""],
    access: [[] as AccessItemValue[]],
  });

  constructor(
    @Inject(DIALOG_DATA) public params: ShareModalParams,
    private dialogRef: DialogRef<ShareModalResult>,
    private formBuilder: FormBuilder,
    private accountService: AccountService,
    private organizationService: OrganizationService,
    private organizationUserApiService: OrganizationUserApiService,
    private groupApiService: GroupApiService,
    private collectionAdminService: CollectionAdminService,
    private cipherService: CipherService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private changeDetectorRef: ChangeDetectorRef,
    private dialogService: DialogService,
  ) {
    this.cipher = params?.cipher;
    if (!this.cipher) {
      // No cipher provided
      this.dialogRef.close({ action: "canceled" });
      return;
    }
  }

  async ngOnInit() {
    await this.loadData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async loadData() {
    this.loading = true;

    try {
      // Get current user ID
      const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

      // Get organizations the user can create collections in
      const organizations = await firstValueFrom(
        this.organizationService
          .organizations$(userId)
          .pipe(
            map((orgs) => orgs.filter((org) => org.canCreateNewCollections && !org.isProviderUser)),
          ),
      );

      if (organizations.length === 0) {
        // No organizations where user can create collections
        this.dialogRef.close({ action: "canceled" });
        return;
      }

      // Use the first available organization (in a real implementation, you might want to let the user choose)
      this.organization = organizations[0];

      // Load groups, users, and existing collections for the organization
      const groupsPromise = this.organization.useGroups
        ? this.groupApiService.getAll(this.organization.id)
        : Promise.resolve([]);

      const usersPromise = this.organizationUserApiService.getAllMiniUserDetails(
        this.organization.id,
      );
      const collectionsPromise = this.collectionAdminService.getAll(this.organization.id);

      const [groups, users, collections] = await Promise.all([
        groupsPromise,
        usersPromise,
        collectionsPromise,
      ]);

      // Store existing collections for permission comparison
      this.existingCollections = collections;

      // Create access items (groups and users available for selection)
      this.accessItems = [
        ...groups.map((group) => this.mapGroupToAccessItemView(group)),
        ...users.data.map((user) => this.mapUserToAccessItemView(user)),
      ];

      // Get current user and add them with "Can Manage" permission by default
      this.currentUser = users.data.find((u) => u.userId === userId);
      if (this.currentUser) {
        const currentUserAccessItem: AccessItemValue = {
          id: this.currentUser.id,
          type: AccessItemType.Member,
          permission: CollectionPermission.Manage,
        };

        this.formGroup.patchValue({
          access: [currentUserAccessItem],
        });
      }

      // Force change detection to update the access selector's items
      this.changeDetectorRef.detectChanges();
    } catch {
      // Error loading data
      this.dialogRef.close({ action: "canceled" });
      return;
    }

    this.loading = false;
  }

  protected get canSave(): boolean {
    if (this.loading) {
      return false;
    }

    const accessValue = this.formGroup.get("access")?.value || [];
    // Must have at least one other user/group besides the current user
    return accessValue.length > 1;
  }

  cancel() {
    this.dialogRef.close({ action: "canceled" });
  }

  done() {
    this.dialogRef.close({ action: "shared" });
  }

  async assignToExistingCollection() {
    if (!this.existingCollection || !this.organization) {
      return;
    }

    this.submitting = true;

    try {
      // Convert cipher to CipherView if needed
      let cipherView: CipherView;
      if ("id" in this.cipher) {
        const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
        const cipher = await this.cipherService.get(this.cipher.id!, userId);
        if (!cipher) {
          // Could not fetch cipher for assignment
          return;
        }
        cipherView = await this.cipherService.decrypt(cipher, userId);
      } else {
        cipherView = this.cipher as CipherView;
      }

      // Check if the cipher is in individual vault or organization vault
      const isIndividualVaultItem = !cipherView.organizationId;

      if (isIndividualVaultItem) {
        await this.shareToOrganizationAndAssign(cipherView, [this.existingCollection!.id!]);
      } else {
        await this.assignOrganizationItemToCollection(cipherView, this.existingCollection!);
      }

      // Assignment was successful
      this.createdCollectionId = this.existingCollection!.id!;
      this.generateShareableLink();
      this.sharingComplete = true;

      // Show success toast
      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("success"),
        message: this.i18nService.t("itemShared"),
      });
    } catch {
      // Error assigning to existing collection
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: "Failed to assign item to collection",
      });
    } finally {
      this.submitting = false;
    }
  }

  private async shareToOrganizationAndAssign(
    cipherView: CipherView,
    collectionIds: string[],
  ): Promise<void> {
    // For individual vault items, use shareWithServer to move to organization
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    await this.cipherService.shareWithServer(
      cipherView,
      this.organization!.id,
      collectionIds,
      userId,
    );
  }

  private async assignOrganizationItemToCollection(
    cipherView: CipherView,
    collection: CollectionAdminView,
  ): Promise<void> {
    // For organization vault items, use saveCollectionsWithServer to update collection assignments
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    // Add the collection ID to the cipher's existing collections (if not already present)
    const existingCollectionIds = cipherView.collectionIds || [];
    if (!existingCollectionIds.includes(collection.id!)) {
      const updatedCollectionIds: string[] = [...existingCollectionIds, collection.id!];

      // Create cipher domain object with updated collection assignments
      const cipher = await this.cipherService.get(cipherView.id!, userId);
      if (!cipher) {
        throw new Error("Could not fetch cipher for collection assignment");
      }

      // Update collection assignments
      cipher.collectionIds = updatedCollectionIds;

      // Use saveCollectionsWithServer to update the cipher's collection assignments
      await this.cipherService.saveCollectionsWithServer(cipher, userId);
    }
  }

  private generateCollectionName(): string {
    if (!this.currentUser) {
      return "Shared Collection";
    }

    const accessValue = this.formGroup.get("access")?.value || [];

    // Filter out the current user to get sharees
    const sharees = accessValue.filter((item: AccessItemValue) => item.id !== this.currentUser!.id);

    if (sharees.length === 0) {
      return "Shared Collection";
    }

    // Get sharer name (current user)
    const sharerName = this.getFirstNameOrFallback(this.currentUser.name, this.currentUser.email);

    // Generate sharee names
    const shareeNames = sharees.map((sharee: AccessItemValue) => {
      if (sharee.type === AccessItemType.Group) {
        // Find group name
        const group = this.accessItems.find(
          (item) => item.id === sharee.id && item.type === AccessItemType.Group,
        );
        return group?.labelName || "Unknown Group";
      } else {
        // Find user name
        const user = this.accessItems.find(
          (item) => item.id === sharee.id && item.type === AccessItemType.Member,
        ) as any;
        if (user) {
          return this.getFirstNameOrFallback(user.labelName, user.email);
        }
        return "Unknown User";
      }
    });

    // Handle multiple sharees
    let shareePart: string;
    if (shareeNames.length === 1) {
      shareePart = shareeNames[0];
    } else if (shareeNames.length === 2) {
      shareePart = `${shareeNames[0]} & ${shareeNames[1]}`;
    } else if (shareeNames.length <= 5) {
      const allButLast = shareeNames.slice(0, -1).join(", ");
      shareePart = `${allButLast} & ${shareeNames[shareeNames.length - 1]}`;
    } else {
      shareePart = `${shareeNames.slice(0, 3).join(", ")} & ${shareeNames.length - 3} others`;
    }

    const finalName = `${sharerName} + ${shareePart}`;
    return finalName;
  }

  private getFirstNameOrFallback(fullName: string, email: string): string {
    if (!fullName || fullName.trim() === "") {
      // Extract name from email before @ symbol
      return email.split("@")[0];
    }

    // Extract first name from full name
    const firstName = fullName.trim().split(" ")[0];
    return firstName || email.split("@")[0];
  }

  submit = async () => {
    if (!this.canSave || this.submitting) {
      return;
    }

    // Prevent form submission when in existing collection step
    if (this.showExistingCollectionStep) {
      return;
    }

    // Check if a collection with the same permissions already exists
    const duplicateCollection = this.findCollectionWithSamePermissions();
    if (duplicateCollection) {
      // Transition to existing collection assignment step - DO NOT CREATE NEW COLLECTION
      this.existingCollection = duplicateCollection;
      this.showExistingCollectionStep = true;
      return; // Exit early - no collection creation
    }
    this.submitting = true;

    try {
      // Create the collection
      const collectionView = await this.createCollection();

      try {
        // Assign the cipher to the newly created collection
        await this.assignCipherToCollection(collectionView.id);

        // Store collection ID and generate shareable link
        this.createdCollectionId = collectionView.id;
        this.generateShareableLink();
        this.sharingComplete = true;

        // Show success toast
        this.toastService.showToast({
          variant: "success",
          title: this.i18nService.t("success"),
          message: this.i18nService.t("itemShared"),
        });
      } catch {
        // Error assigning cipher to collection

        // Collection was created but assignment failed - still show shareable link
        this.createdCollectionId = collectionView.id;
        this.generateShareableLink();
        this.sharingComplete = true;

        // Collection was created but assignment failed
        this.toastService.showToast({
          variant: "warning",
          title: this.i18nService.t("warning"),
          message: this.i18nService.t("collectionCreatedButAssignmentFailed"),
        });
      }
    } catch {
      // Error creating collection

      // Show error toast
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("collectionCreationFailed"),
      });
    } finally {
      this.submitting = false;
    }
  };

  private async createCollection(): Promise<any> {
    if (!this.organization) {
      throw new Error("No organization available");
    }

    // Build the collection object
    const collectionView = new CollectionAdminView();
    collectionView.organizationId = this.organization.id;

    // Generate collection name if empty, otherwise use provided name
    const providedName = this.formGroup.get("collectionName")?.value;
    if (!providedName || providedName.trim() === "") {
      collectionView.name = this.generateCollectionName();
    } else {
      collectionView.name = providedName;
    }

    // Set up user permissions
    const accessValue = this.formGroup.get("access")?.value || [];
    collectionView.users = accessValue
      .filter((v: AccessItemValue) => v.type === AccessItemType.Member)
      .map(convertToSelectionView);

    // Set up group permissions
    collectionView.groups = accessValue
      .filter((v: AccessItemValue) => v.type === AccessItemType.Group)
      .map(convertToSelectionView);

    // Get current user ID for the API call
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    // Create the collection via API
    const savedCollection = await this.collectionAdminService.save(collectionView, userId);

    return savedCollection;
  }

  private findCollectionWithSamePermissions(): CollectionAdminView | null {
    const currentPermissions = this.getCurrentPermissionSet();

    for (const collection of this.existingCollections) {
      // Only consider collections where the current user has sharing permissions (Can Manage or Can Edit)
      if (!this.canUserShareInCollection(collection)) {
        continue;
      }

      const collectionPermissions = this.getCollectionPermissionSet(collection);

      if (this.arePermissionSetsEqual(currentPermissions, collectionPermissions)) {
        return collection;
      }
    }

    return null;
  }

  private canUserShareInCollection(collection: CollectionAdminView): boolean {
    if (!this.currentUser) {
      return false;
    }

    // Find the current user's permission in this collection
    const userPermission = collection.users?.find((user) => user.id === this.currentUser!.id);
    if (userPermission) {
      const permission = this.convertCollectionAccessToPermission(userPermission);
      // Users can share if they have Can Manage or Can Edit permissions
      return permission === CollectionPermission.Manage || permission === CollectionPermission.Edit;
    }

    // Also check if user has sharing permissions through groups
    if (collection.groups && this.currentUser) {
      // This would require knowing which groups the current user belongs to
      // For now, we'll focus on direct user permissions
      // TODO: Add group permission checking if needed
    }

    return false;
  }

  private getCurrentPermissionSet(): PermissionSet {
    const accessValue = this.formGroup.get("access")?.value || [];

    const permissionSet: PermissionSet = {
      users: new Map(),
      groups: new Map(),
    };

    accessValue.forEach((item: AccessItemValue) => {
      if (item.type === AccessItemType.Member) {
        permissionSet.users.set(item.id, item.permission || CollectionPermission.View);
      } else if (item.type === AccessItemType.Group) {
        permissionSet.groups.set(item.id, item.permission || CollectionPermission.View);
      }
    });

    return permissionSet;
  }

  private getCollectionPermissionSet(collection: CollectionAdminView): PermissionSet {
    const permissionSet: PermissionSet = {
      users: new Map(),
      groups: new Map(),
    };

    // Extract user permissions from collection
    if (collection.users) {
      collection.users.forEach((user) => {
        // Convert collection permissions to our permission format
        const permission = this.convertCollectionAccessToPermission(user);
        permissionSet.users.set(user.id, permission);
      });
    }

    // Extract group permissions from collection
    if (collection.groups) {
      collection.groups.forEach((group) => {
        // Convert collection permissions to our permission format
        const permission = this.convertCollectionAccessToPermission(group);
        permissionSet.groups.set(group.id, permission);
      });
    }

    return permissionSet;
  }

  private convertCollectionAccessToPermission(access: any): CollectionPermission {
    // Convert the collection access model to our CollectionPermission enum
    // This maps the boolean fields (manage, readOnly, hidePasswords) to our permission system
    if (access.manage) {
      return CollectionPermission.Manage;
    } else if (access.readOnly) {
      if (access.hidePasswords) {
        return CollectionPermission.ViewExceptPass;
      } else {
        return CollectionPermission.View;
      }
    } else {
      // Can edit
      if (access.hidePasswords) {
        return CollectionPermission.EditExceptPass;
      } else {
        return CollectionPermission.Edit;
      }
    }
  }

  private arePermissionSetsEqual(set1: PermissionSet, set2: PermissionSet): boolean {
    // Compare user permissions
    if (set1.users.size !== set2.users.size) {
      return false;
    }

    for (const [userId, permission] of set1.users) {
      if (set2.users.get(userId) !== permission) {
        return false;
      }
    }

    // Compare group permissions
    if (set1.groups.size !== set2.groups.size) {
      return false;
    }

    for (const [groupId, permission] of set1.groups) {
      if (set2.groups.get(groupId) !== permission) {
        return false;
      }
    }

    return true;
  }

  private mapGroupToAccessItemView(group: GroupView): AccessItemView {
    return {
      id: group.id,
      type: AccessItemType.Group,
      listName: group.name,
      labelName: group.name,
      readonlyPermission: undefined,
    };
  }

  private mapUserToAccessItemView(user: OrganizationUserUserMiniResponse): AccessItemView {
    return {
      id: user.id,
      type: AccessItemType.Member,
      listName: user.name || user.email,
      labelName: user.name || user.email,
      readonlyPermission: undefined,
      email: user.email,
      role: user.type,
      status: user.status,
    };
  }

  private async assignCipherToCollection(collectionId: string): Promise<void> {
    if (!this.organization) {
      throw new Error("No organization available for assignment");
    }

    // Convert cipher to CipherView if needed
    let cipherView: CipherView;
    if ("id" in this.cipher) {
      // Convert CipherListView to CipherView
      const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
      const cipher = await this.cipherService.get(this.cipher.id!, userId);
      if (!cipher) {
        throw new Error("Could not fetch cipher for assignment");
      }
      cipherView = await this.cipherService.decrypt(cipher, userId);
    } else {
      cipherView = this.cipher as CipherView;
    }

    // Check if the cipher is in individual vault or organization vault
    const isIndividualVaultItem = !cipherView.organizationId;

    if (isIndividualVaultItem) {
      // For individual vault items, use shareWithServer to move to organization
      await this.shareToOrganizationAndAssign(cipherView, [collectionId]);
    } else {
      // For organization vault items, find the target collection and assign
      const targetCollection = this.existingCollections.find((c) => c.id === collectionId);
      if (!targetCollection) {
        throw new Error(`Collection with ID ${collectionId} not found`);
      }

      await this.assignOrganizationItemToCollection(cipherView, targetCollection);
    }
  }

  private generateShareableLink(): void {
    // Generate the web vault URL with collection ID and item ID parameters
    // Format: https://<client>/#/vault?collectionId=[collection-id]&itemId=[item-id]
    const baseUrl = window.location.origin;
    this.shareableLink = `${baseUrl}/#/vault?collectionId=${this.createdCollectionId}&itemId=${this.cipher.id}`;
  }

  protected async copyShareLink(inputElement: HTMLInputElement): Promise<void> {
    try {
      // Select and copy the link
      inputElement.select();
      inputElement.setSelectionRange(0, 99999); // For mobile devices

      // Use the modern clipboard API if available
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(this.shareableLink);
      } else {
        // Fallback for older browsers
        document.execCommand("copy");
      }

      // Show success feedback
      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("success"),
        message: "Share link copied to clipboard",
      });
    } catch {
      // Error copying share link

      // Show error feedback
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: "Failed to copy link to clipboard",
      });
    }
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<ShareModalParams>,
  ): DialogRef<ShareModalResult> {
    return dialogService.open<ShareModalResult>(ShareModalComponent, config);
  }
}
