import { inject, Injectable } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  from,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

import {
  CollectionAdminService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { getById } from "@bitwarden/common/platform/misc";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";

import { InternalGroupApiService as GroupService } from "../../core";
import { AddEditGroupDetail } from "../../core/views/add-edit-group-detail";
import {
  AccessItemType,
  AccessItemValue,
  AccessItemView,
  convertToPermission,
  convertToSelectionView,
} from "../../shared/components/access-selector";

import { AccessMemberItemView, GroupFormGroup } from "./group-add-edit.types";

/**
 * Owns all data streams, API access, form building, and save/delete business logic for the
 * group add/edit dialogs.
 */
@Injectable()
export class GroupAddEditService {
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly collectionAdminService = inject(CollectionAdminService);
  private readonly organizationUserApiService = inject(OrganizationUserApiService);
  private readonly groupService = inject(GroupService);
  private readonly apiService = inject(ApiService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly formBuilder = inject(FormBuilder);

  buildForm(): GroupFormGroup {
    return this.formBuilder.group({
      name: this.formBuilder.control<string | null>("", [
        Validators.required,
        Validators.maxLength(100),
      ]),
      externalId: this.formBuilder.control<string | null>({ value: "", disabled: false }),
      members: this.formBuilder.control<AccessItemValue[] | null>([]),
      collections: this.formBuilder.control<AccessItemValue[] | null>([]),
    });
  }

  organization$(organizationId: string): Observable<Organization | undefined> {
    return this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.organizationService.organizations$(userId)),
      getById(organizationId),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  orgCollections$(organizationId: string): Observable<CollectionAdminView[]> {
    return this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.collectionAdminService.collectionAdminViews$(organizationId, userId),
      ),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  orgMembers$(organizationId: string): Observable<AccessMemberItemView[]> {
    return from(this.organizationUserApiService.getAllMiniUserDetails(organizationId)).pipe(
      map((response) =>
        response.data.map<AccessMemberItemView>((m) => ({
          id: m.id,
          type: AccessItemType.Member,
          email: m.email,
          role: m.type,
          listName: m.name != null && m.name.length > 0 ? `${m.name} (${m.email})` : m.email,
          labelName: m.name != null && m.name.length > 0 ? m.name : m.email,
          status: m.status,
          userId: m.userId as UserId,
        })),
      ),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  groupDetails$(
    organizationId: string,
    groupId?: string,
  ): Observable<AddEditGroupDetail | undefined> {
    if (groupId == null) {
      return of(undefined);
    }
    return combineLatest([
      this.groupService.get(organizationId, groupId),
      this.apiService.getGroupUsers(organizationId, groupId),
    ]).pipe(
      map(([groupView, users]): AddEditGroupDetail => ({ ...groupView, members: users })),
      catchError((e: unknown) => {
        if (e instanceof ErrorResponse) {
          this.logService.error(e.message);
        } else {
          this.logService.error(String(e));
        }
        return of(undefined);
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  allowAdminAccessToAllCollectionItems$(organizationId: string): Observable<boolean> {
    return this.organization$(organizationId).pipe(
      map((organization) => organization?.allowAdminAccessToAllCollectionItems ?? false),
    );
  }

  canAssignAccessToAnyCollection$(organizationId: string): Observable<boolean> {
    return combineLatest([
      this.organization$(organizationId),
      this.allowAdminAccessToAllCollectionItems$(organizationId),
    ]).pipe(
      map(
        ([org, allowAdminAccessToAllCollectionItems]) =>
          org != null &&
          (org.canEditAnyCollection ||
            // Manage Groups custom permission cannot edit any collection but they can assign
            // access from this dialog if permitted by collection management settings.
            (org.permissions.manageGroups && allowAdminAccessToAllCollectionItems)),
      ),
    );
  }

  cannotAddSelfToGroup$(organizationId: string, groupId?: string): Observable<boolean> {
    return combineLatest([
      this.allowAdminAccessToAllCollectionItems$(organizationId),
      this.groupDetails$(organizationId, groupId),
    ]).pipe(map(([allowAdminAccess, groupDetails]) => !allowAdminAccess && groupDetails != null));
  }

  collectionAccessItems$(organizationId: string, groupId?: string): Observable<AccessItemView[]> {
    return combineLatest([
      this.orgCollections$(organizationId),
      this.organization$(organizationId),
      this.groupDetails$(organizationId, groupId),
    ]).pipe(
      map(([collections, organization, group]) =>
        organization == null ? [] : this.mapToAccessItemViews(collections, organization, group),
      ),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  /**
   * Members list for the members tab. Excludes the current user when they are not already in
   * the group and are not permitted to add themselves.
   */
  memberAccessItems$(organizationId: string, groupId?: string): Observable<AccessMemberItemView[]> {
    return combineLatest([
      this.orgMembers$(organizationId),
      this.cannotAddSelfToGroup$(organizationId, groupId),
      this.accountService.activeAccount$,
      this.groupDetails$(organizationId, groupId),
    ]).pipe(
      map(([members, restrictGroupAccess, activeAccount, group]) => {
        if (!restrictGroupAccess || activeAccount == null) {
          return members;
        }
        // organizationUserId may be undefined if accessing via a provider
        const organizationUserId = members.find((m) => m.userId === activeAccount.id)?.id;
        const isAlreadyInGroup = group?.members.some((m) => m === organizationUserId) ?? false;
        if (organizationUserId != null && !isAlreadyInGroup) {
          return members.filter((m) => m.id !== organizationUserId);
        }
        return members;
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  /** Emits `true` once the derived view state has settled and the dialog can render its form. */
  loaded$(organizationId: string, groupId?: string): Observable<boolean> {
    return combineLatest([
      this.organization$(organizationId),
      this.collectionAccessItems$(organizationId, groupId),
      this.memberAccessItems$(organizationId, groupId),
      this.groupDetails$(organizationId, groupId),
    ]).pipe(
      map(([organization]) => organization != null),
      distinctUntilChanged(),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  /**
   * Persists the group. Returns without saving when required form values are missing;
   * the caller should mark the form as touched first and short-circuit on `form.invalid`.
   */
  async save(form: GroupFormGroup, organizationId: string, groupId?: string): Promise<void> {
    const formValue = form.value;
    if (formValue.name == null || formValue.collections == null) {
      return;
    }

    const groupView: AddEditGroupDetail = {
      id: groupId,
      organizationId,
      name: formValue.name,
      members: formValue.members?.map((m) => m.id) ?? [],
      collections: formValue.collections.map((c) => convertToSelectionView(c)),
      externalId: formValue.externalId ?? undefined,
    };

    await this.groupService.save(groupView);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t(
        groupId != null ? "editedGroupId" : "createdGroupId",
        formValue.name,
      ),
    });
  }

  /**
   * Prompts the user, deletes the group, and toasts. Returns `true` when deleted, `false` when
   * the user declined.
   */
  async confirmAndDelete(
    organizationId: string,
    groupId: string,
    groupName: string,
  ): Promise<boolean> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: groupName,
      content: { key: "deleteGroupConfirmation" },
      type: "warning",
    });
    if (!confirmed) {
      return false;
    }

    await this.groupService.delete(organizationId, groupId);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("deletedGroupId", groupName),
    });
    return true;
  }

  /**
   * Maps the organization's collections to AccessItemViews to populate the access-selector's
   * multi-select.
   */
  private mapToAccessItemViews(
    collections: CollectionAdminView[],
    organization: Organization,
    group?: AddEditGroupDetail,
  ): AccessItemView[] {
    return (
      collections
        .map<AccessItemView>((c) => {
          const accessSelection =
            group?.collections.find((access) => access.id == c.id) ?? undefined;
          return {
            id: c.id,
            type: AccessItemType.Collection,
            labelName: c.name,
            listName: c.name,
            readonly: !c.canEditGroupAccess(organization),
            readonlyPermission: accessSelection ? convertToPermission(accessSelection) : undefined,
          };
        })
        // Remove any collection views that are not already assigned and that we don't have permissions to assign access to
        .filter(
          (item) => !item.readonly || group?.collections.some((access) => access.id == item.id),
        )
    );
  }
}
