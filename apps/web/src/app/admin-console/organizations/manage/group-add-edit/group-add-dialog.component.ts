import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs";

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
  private readonly groupAddEditService = inject(GroupAddEditService);
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

  protected readonly tabIndex = signal<number>(this.params.initialTab ?? GroupAddEditTabType.Info);
  protected readonly title = computed(() =>
    this.i18nService.t(this.btnTextAddCreateFeatureFlag() ? "addGroup" : "newGroup"),
  );
  protected readonly groupForm: GroupFormGroup = this.groupAddEditService.buildForm();

  private readonly organization$ = this.groupAddEditService.organization$(this.organizationId);
  private readonly groupDetails$ = this.groupAddEditService.groupDetails$(this.organizationId);

  protected readonly collections$ = this.groupAddEditService.collectionAccessItems$(
    this.organizationId,
    this.organization$,
    this.groupDetails$,
  );
  protected readonly members$ = this.groupAddEditService.memberAccessItems$(
    this.organizationId,
    this.organization$,
    this.groupDetails$,
  );
  protected readonly loaded$ = this.groupAddEditService.loaded$(
    this.organization$,
    this.collections$,
    this.members$,
    this.groupDetails$,
  );
  protected readonly cannotAddSelfToGroup$ = this.groupAddEditService.cannotAddSelfToGroup$(
    this.organization$,
    this.groupDetails$,
  );
  protected readonly canAssignAccessToAnyCollection$ = this.organization$.pipe(
    map((organization) => organization?.canAssignAccessToAnyCollection ?? false),
  );

  readonly submit = async (): Promise<void> => {
    this.groupForm.markAllAsTouched();

    if (this.groupForm.invalid) {
      if (this.tabIndex() !== GroupAddEditTabType.Info) {
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

    await this.groupAddEditService.save(this.groupForm, this.organizationId);
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
