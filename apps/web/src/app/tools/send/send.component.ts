import { Component, NgZone, ViewChild, ViewContainerRef } from "@angular/core";

import { DialogServiceAbstraction } from "@bitwarden/angular/services/dialog";
import { ModalService } from "@bitwarden/angular/services/modal.service";
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
import { NoItemsModule, SearchModule, TableDataSource } from "@bitwarden/components";

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
export class SendComponent extends BaseSendComponent {
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
    private modalService: ModalService,
    private broadcasterService: BroadcasterService,
    logService: LogService,
    sendApiService: SendApiService,
    dialogService: DialogServiceAbstraction
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
      dialogService
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

    const component = await this.editSend(null);
    component.type = this.type;
  }

  async editSend(send: SendView) {
    const [modal, childComponent] = await this.modalService.openViewRef(
      AddEditComponent,
      this.sendAddEditModalRef,
      (comp) => {
        comp.sendId = send == null ? null : send.id;
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onSavedSend.subscribe(async () => {
          modal.close();
          await this.load();
        });
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onDeletedSend.subscribe(async () => {
          modal.close();
          await this.load();
        });
      }
    );

    return childComponent;
  }
}
