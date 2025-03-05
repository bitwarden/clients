// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogRef } from "@angular/cdk/dialog";
import { Component, NgZone, OnInit, OnDestroy } from "@angular/core";
import { lastValueFrom } from "rxjs";

import { SendComponent as BaseSendComponent } from "@bitwarden/angular/tools/send/send.component";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { SendId } from "@bitwarden/common/types/guid";
import {
  DialogService,
  NoItemsModule,
  SearchModule,
  TableDataSource,
  ToastService,
} from "@bitwarden/components";
import {
  DefaultSendFormConfigService,
  NoSendsIcon,
  SendFormConfig,
  SendAddEditDialogComponent,
  SendItemDialogResult,
} from "@bitwarden/send-ui";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

import { NewSendDropdownComponent } from "./new-send/new-send-dropdown.component";

const BroadcasterSubscriptionId = "SendComponent";

@Component({
  selector: "app-send",
  standalone: true,
  imports: [SharedModule, SearchModule, NoItemsModule, HeaderModule, NewSendDropdownComponent],
  templateUrl: "send.component.html",
  providers: [DefaultSendFormConfigService],
})
export class SendComponent extends BaseSendComponent implements OnInit, OnDestroy {
  private sendItemDialogRef?: DialogRef<SendItemDialogResult> | undefined;
  noItemIcon = NoSendsIcon;

  override set filteredSends(filteredSends: SendView[]) {
    super.filteredSends = filteredSends;
    this.dataSource.data = filteredSends;
  }

  override get filteredSends() {
    return super.filteredSends;
  }

  protected dataSource = new TableDataSource<SendView>();

  constructor(
    sendService: SendService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    environmentService: EnvironmentService,
    ngZone: NgZone,
    searchService: SearchService,
    policyService: PolicyService,
    private broadcasterService: BroadcasterService,
    logService: LogService,
    sendApiService: SendApiService,
    dialogService: DialogService,
    toastService: ToastService,
    private addEditFormConfigService: DefaultSendFormConfigService,
  ) {
    super(
      sendService,
      i18nService,
      platformUtilsService,
      environmentService,
      ngZone,
      searchService,
      policyService,
      logService,
      sendApiService,
      dialogService,
      toastService,
    );
  }

  async ngOnInit() {
    await super.ngOnInit();
    await this.load();

    // Broadcaster subscription - load if sync completes in the background
    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.ngZone.run(async () => {
        switch (message.command) {
          case "syncCompleted":
            if (message.successfully) {
              await this.load();
            }
            break;
        }
      });
    });
  }

  ngOnDestroy() {
    this.dialogService.closeAll();
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
  }

  async addSend() {
    if (this.disableSend) {
      return;
    }

    const config = await this.addEditFormConfigService.buildConfig("add", null, 0);

    await this.openSendItemDialog(config);
  }

  async editSend(send: SendView) {
    const config = await this.addEditFormConfigService.buildConfig(
      send == null ? "add" : "edit",
      send == null ? null : (send.id as SendId),
      send.type,
    );

    await this.openSendItemDialog(config);
  }

  /**
   * Opens the send item dialog.
   * @param formConfig The form configuration.
   * */
  async openSendItemDialog(formConfig: SendFormConfig) {
    // Prevent multiple dialogs from being opened.
    if (this.sendItemDialogRef) {
      return;
    }

    this.sendItemDialogRef = SendAddEditDialogComponent.open(this.dialogService, {
      formConfig,
    });

    const result = await lastValueFrom(this.sendItemDialogRef.closed);
    this.sendItemDialogRef = undefined;

    // If the dialog was closed by deleting the cipher, refresh the vault.
    if (result === SendItemDialogResult.Deleted || result === SendItemDialogResult.Saved) {
      await this.load();
    }
  }
}
