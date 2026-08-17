import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { UserTypePipe } from "@bitwarden/angular/pipes/user-type.pipe";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  AvatarModule,
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  TableModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { OrganizationUserView } from "../../../core";
import { AvatarIdPipe } from "../../pipes/avatar-id.pipe";

export type BulkEnablePrivilegedControlsDialogData = {
  orgId: string;
  users: OrganizationUserView[];
};

@Component({
  templateUrl: `bulk-enable-privileged-controls-dialog.component.html`,
  selector: "app-bulk-enable-privileged-controls-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    AvatarIdPipe,
    AvatarModule,
    ButtonModule,
    DialogModule,
    I18nPipe,
    TableModule,
    UserNamePipe,
    UserTypePipe,
  ],
})
export class BulkEnablePrivilegedControlsDialogComponent {
  protected readonly dialogRef = inject(DialogRef);
  private readonly data = inject<BulkEnablePrivilegedControlsDialogData>(DIALOG_DATA);
  private readonly organizationUserApiService = inject(OrganizationUserApiService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);

  protected readonly users = signal<OrganizationUserView[]>([]);

  constructor() {
    this.users.set(this.data.users);
  }

  readonly submit = async () => {
    await this.organizationUserApiService.putOrganizationUserBulkEnablePam(
      this.data.orgId,
      this.users().map((u) => u.id),
    );
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("activatedAccessToPrivilegedControls"),
    });
    await this.dialogRef.close();
  };

  static open(dialogService: DialogService, data: BulkEnablePrivilegedControlsDialogData) {
    return dialogService.open<unknown, BulkEnablePrivilegedControlsDialogData>(
      BulkEnablePrivilegedControlsDialogComponent,
      {
        data,
      },
    );
  }
}
