import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import {
  DialogService,
  IconButtonModule,
  LinkModule,
  MenuModule,
  TableModule,
  ToastService,
} from "@bitwarden/components";

import { DefaultSendFormConfigService } from "../send-form";

import { SendListItemsContainerBaseComponent } from "./send-list-items-container-base.component";

@Component({
  selector: "tools-send-list-table",
  standalone: true,
  imports: [CommonModule, JslibModule, TableModule, LinkModule, MenuModule, IconButtonModule],
  templateUrl: "send-list-table.component.html",
  providers: [DefaultSendFormConfigService],
})
export class SendListTableComponent extends SendListItemsContainerBaseComponent {
  constructor(
    protected dialogService: DialogService,
    protected environmentService: EnvironmentService,
    protected i18nService: I18nService,
    protected logService: LogService,
    protected platformUtilsService: PlatformUtilsService,
    protected sendApiService: SendApiService,
    protected toastService: ToastService,
    protected addEditFormConfigService: DefaultSendFormConfigService,
  ) {
    super(
      dialogService,
      environmentService,
      i18nService,
      logService,
      platformUtilsService,
      sendApiService,
      toastService,
      addEditFormConfigService,
    );
  }
}
