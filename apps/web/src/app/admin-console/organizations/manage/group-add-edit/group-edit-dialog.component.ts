import { ChangeDetectionStrategy, Component, effect, inject } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { Vfo1I18nPipe } from "@bitwarden/vault";

import { SharedModule } from "../../../../shared";
import { AddEditGroupDetail } from "../../core/views/add-edit-group-detail";
import {
  AccessItemType,
  AccessItemValue,
  AccessItemView,
  AccessSelectorModule,
  convertToPermission,
  PermissionMode,
} from "../../shared/components/access-selector";

import { GroupAddEditService } from "./group-add-edit.service";
import {
  GroupAddEditDialogResultType,
  GroupAddEditTabType,
  GroupEditDialogParams,
  GroupFormGroup,
} from "./group-add-edit.types";

/**
 * Maps the group's current collection access to AccessItemValues to populate the
 * access-selector's FormControl. The FormControl value only represents editable collection
 * access - exclude readonly access selections.
 */
function mapToAccessSelections(
  group: AddEditGroupDetail,
  items: AccessItemView[],
): AccessItemValue[] {
  return group.collections
    .filter((selection) => !items.find((item) => item.id == selection.id)?.readonly)
    .map((gc) => ({
      id: gc.id,
      type: AccessItemType.Collection,
      permission: convertToPermission(gc),
    }));
}

@Component({
  selector: "app-group-edit-dialog",
  templateUrl: "group-edit-dialog.component.html",
  imports: [SharedModule, AccessSelectorModule, Vfo1I18nPipe],
  providers: [GroupAddEditService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupEditDialogComponent {
  private readonly params = inject<GroupEditDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<GroupAddEditDialogResultType>>(DialogRef);
  private readonly service = inject(GroupAddEditService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);

  private readonly organizationId = this.params.organizationId;
  private readonly groupId = this.params.groupId;

  protected readonly PermissionMode = PermissionMode;
  protected readonly ResultType = GroupAddEditDialogResultType;

  protected readonly tabIndex = this.params.initialTab ?? GroupAddEditTabType.Info;
  protected readonly title = this.i18nService.t("editGroup");
  protected readonly groupForm: GroupFormGroup = this.service.buildForm();

  // Template streams (consumed via async pipe)
  protected readonly collections$ = this.service.collectionAccessItems$(
    this.organizationId,
    this.groupId,
  );
  protected readonly members$ = this.service.memberAccessItems$(this.organizationId, this.groupId);
  protected readonly loaded$ = this.service.loaded$(this.organizationId, this.groupId);
  protected readonly cannotAddSelfToGroup$ = this.service.cannotAddSelfToGroup$(
    this.organizationId,
    this.groupId,
  );
  protected readonly canAssignAccessToAnyCollection$ = this.service.canAssignAccessToAnyCollection$(
    this.organizationId,
  );

  /**
   * Group details drive both the form patch below and the delete-flow group name; expose as a
   * signal so the template can render `group()?.name` reactively.
   */
  protected readonly group = toSignal(
    this.service.groupDetails$(this.organizationId, this.groupId).pipe(takeUntilDestroyed()),
    { initialValue: undefined },
  );

  private readonly collections = toSignal(this.collections$.pipe(takeUntilDestroyed()), {
    initialValue: [] as AccessItemView[],
  });

  constructor() {
    effect(() => {
      const group = this.group();
      if (group == null) {
        return;
      }
      this.groupForm.patchValue({
        name: group.name,
        externalId: group.externalId,
        members: group.members.map((m) => ({ id: m, type: AccessItemType.Member })),
        collections: mapToAccessSelections(group, this.collections()),
      });
    });
  }

  protected get isExternalIdVisible(): boolean {
    return !!this.groupForm.get("externalId")?.value;
  }

  readonly submit = async (): Promise<void> => {
    this.groupForm.markAllAsTouched();

    if (this.groupForm.invalid) {
      if (this.tabIndex !== GroupAddEditTabType.Info) {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t(
            "fieldOnTabRequiresAttention",
            this.i18nService.t("groupInfo"),
          ),
        });
      }
      return;
    }

    await this.service.save(this.groupForm, this.organizationId, this.groupId);
    await this.dialogRef.close(GroupAddEditDialogResultType.Saved);
  };

  readonly delete = async (): Promise<boolean | undefined> => {
    const group = this.group();
    if (group == null) {
      return false;
    }
    const deleted = await this.service.confirmAndDelete(
      this.organizationId,
      this.groupId,
      group.name,
    );
    if (!deleted) {
      return false;
    }
    await this.dialogRef.close(GroupAddEditDialogResultType.Deleted);
    return undefined;
  };
}

export const openEditGroupDialog = (
  dialogService: DialogService,
  config: DialogConfig<GroupEditDialogParams>,
) =>
  dialogService.open<GroupAddEditDialogResultType, GroupEditDialogParams>(
    GroupEditDialogComponent,
    config,
  );
