import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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
import { AccessSelectorModule, PermissionMode } from "../../shared/components/access-selector";

import { GroupAddEditService } from "./group-add-edit.service";
import {
  GroupAddDialogParams,
  GroupAddEditDialogResultType,
  GroupAddEditTabType,
  GroupFormGroup,
} from "./group-add-edit.types";

@Component({
  selector: "app-group-add-dialog",
  templateUrl: "group-add-dialog.component.html",
  imports: [SharedModule, AccessSelectorModule, Vfo1I18nPipe],
  providers: [GroupAddEditService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupAddDialogComponent {
  private readonly params = inject<GroupAddDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<GroupAddEditDialogResultType>>(DialogRef);
  private readonly service = inject(GroupAddEditService);
  private readonly configService = inject(ConfigService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);

  private readonly organizationId = this.params.organizationId;

  private readonly btnTextAddCreateFeatureFlag = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM32380_BtnTextAddCreate),
    { initialValue: false },
  );

  protected readonly PermissionMode = PermissionMode;
  protected readonly ResultType = GroupAddEditDialogResultType;

  protected readonly tabIndex = this.params.initialTab ?? GroupAddEditTabType.Info;
  protected readonly title = this.i18nService.t(
    this.btnTextAddCreateFeatureFlag() ? "addGroup" : "newGroup",
  );
  protected readonly groupForm: GroupFormGroup = this.service.buildForm();

  protected readonly collections$ = this.service.collectionAccessItems$(this.organizationId);
  protected readonly members$ = this.service.memberAccessItems$(this.organizationId);
  protected readonly loaded$ = this.service.loaded$(this.organizationId);
  protected readonly cannotAddSelfToGroup$ = this.service.cannotAddSelfToGroup$(
    this.organizationId,
  );
  protected readonly canAssignAccessToAnyCollection$ = this.service.canAssignAccessToAnyCollection$(
    this.organizationId,
  );

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

    await this.service.save(this.groupForm, this.organizationId);
    await this.dialogRef.close(GroupAddEditDialogResultType.Saved);
  };
}

export const openAddGroupDialog = (
  dialogService: DialogService,
  config: DialogConfig<GroupAddDialogParams>,
) =>
  dialogService.open<GroupAddEditDialogResultType, GroupAddDialogParams>(
    GroupAddDialogComponent,
    config,
  );
