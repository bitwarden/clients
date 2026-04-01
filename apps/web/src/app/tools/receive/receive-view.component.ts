import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, Inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs";

import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { buildReceiveUrl } from "@bitwarden/common/tools/receive/models/receive-url-data";
import { ReceiveView } from "@bitwarden/common/tools/receive/models/view/receive.view";
import {
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ReceiveAddEditComponent } from "./receive-add-edit.component";
import { ReceiveFilesViewComponent } from "./receive-files-view.component";

@Component({
  templateUrl: "./receive-view.component.html",
  imports: [
    DatePipe,
    DialogModule,
    ButtonModule,
    FormFieldModule,
    IconButtonModule,
    I18nPipe,
    ReceiveFilesViewComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiveViewComponent {
  private readonly baseReceiveUrl = toSignal(
    this.environmentService.environment$.pipe(map((env) => env.getWebVaultUrl() + "/#/receive")),
  );

  protected readonly receiveLink = computed(() => {
    const baseUrl = this.baseReceiveUrl();
    if (!baseUrl) {
      return null;
    }
    return buildReceiveUrl(this.receive, baseUrl);
  });

  constructor(
    @Inject(DIALOG_DATA) protected readonly receive: ReceiveView,
    private readonly dialogRef: DialogRef,
    private readonly dialogService: DialogService,
    private readonly i18nService: I18nService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly toastService: ToastService,
    private readonly environmentService: EnvironmentService,
  ) {}

  protected copyLink(): void {
    const receiveLink = this.receiveLink();
    if (!receiveLink) {
      return;
    }
    this.platformUtilsService.copyToClipboard(receiveLink);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("valueCopied", this.i18nService.t("receiveLink")),
    });
  }

  protected openEdit(): void {
    this.dialogRef.close();
    this.dialogService.openDrawer(ReceiveAddEditComponent, {
      data: this.receive,
      closeOnNavigation: true,
    });
  }
}
