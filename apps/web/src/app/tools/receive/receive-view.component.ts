import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, Inject, OnInit, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

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

@Component({
  templateUrl: "./receive-view.component.html",
  imports: [DatePipe, DialogModule, ButtonModule, FormFieldModule, IconButtonModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiveViewComponent implements OnInit {
  protected readonly receiveLink = signal("");

  constructor(
    @Inject(DIALOG_DATA) protected readonly receive: ReceiveView,
    private readonly dialogRef: DialogRef,
    private readonly dialogService: DialogService,
    private readonly i18nService: I18nService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly toastService: ToastService,
    private readonly environmentService: EnvironmentService,
  ) {}

  async ngOnInit(): Promise<void> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const baseUrl = env.getWebVaultUrl() + "/#/receive";
    this.receiveLink.set(buildReceiveUrl(this.receive, baseUrl));
  }

  protected copyLink(): void {
    this.platformUtilsService.copyToClipboard(this.receiveLink());
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("valueCopied", this.i18nService.t("sendLink")),
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
