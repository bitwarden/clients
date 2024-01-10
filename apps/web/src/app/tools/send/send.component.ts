import { Component, NgZone, ViewChild, OnInit, OnDestroy, ViewContainerRef } from "@angular/core";
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
import { DialogService, NoItemsModule, SearchModule, TableDataSource } from "@bitwarden/components";

import { SharedModule } from "../../shared";

import { AddEditComponent } from "./add-edit.component";
import { NoSend } from "./icons/no-send.icon";

const BroadcasterSubscriptionId = "SendComponent";

@Component({
  selector: "app-send",
  standalone: true,
  imports: [SharedModule, SearchModule, NoItemsModule],
  templateUrl: "send.component.html",
})
export class SendComponent extends BaseSendComponent implements OnInit, OnDestroy {
  @ViewChild("sendAddEdit", { read: ViewContainerRef, static: true })
  sendAddEditModalRef: ViewContainerRef;
  noItemIcon = NoSend;

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
    );
  }

  async ngOnInit() {
    await super.ngOnInit();
    await this.load();

    // Broadcaster subscription - load if sync completes in the background
    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
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
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
  }

  async addSend() {
    if (this.disableSend) {
      return;
    }

    await this.editSend(null);
  }

  async editSend(send: SendView) {
    const dialog = this.dialogService.open(AddEditComponent, {
      data: {
        sendId: send == null ? null : send.id,
      },
    });

    await lastValueFrom(dialog.closed);
    await this.load();
  }
}
