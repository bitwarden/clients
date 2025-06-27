// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule, Location } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { map, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  IconButtonModule,
  SearchModule,
  ToastService,
} from "@bitwarden/components";
import {
  DefaultSendFormConfigService,
  SendFormConfig,
  SendFormConfigService,
  SendFormMode,
  SendFormModule,
} from "@bitwarden/send-ui";

import { PopupBackBrowserDirective } from "../../../../platform/popup/layout/popup-back.directive";
import { PopupFooterComponent } from "../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";
import { SendFilePopoutDialogContainerComponent } from "../send-file-popout-dialog/send-file-popout-dialog-container.component";

/**
 * Helper class to parse query parameters for the AddEdit route.
 */
class QueryParams {
  constructor(params: Params) {
    this.sendId = params.sendId;
    this.type = parseInt(params.type, 10);
  }

  /**
   * The ID of the send to edit, empty when it's a new Send
   */
  sendId?: SendId;

  /**
   * The type of send to create.
   */
  type: SendType;
}

export type AddEditQueryParams = Partial<Record<keyof QueryParams, string>>;

/**
 * Component for adding or editing a send item.
 */
@Component({
  selector: "tools-send-add-edit",
  templateUrl: "send-add-edit.component.html",
  providers: [{ provide: SendFormConfigService, useClass: DefaultSendFormConfigService }],
  imports: [
    CommonModule,
    SearchModule,
    JslibModule,
    FormsModule,
    ButtonModule,
    IconButtonModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    SendFilePopoutDialogContainerComponent,
    SendFormModule,
    AsyncActionsModule,
    PopupBackBrowserDirective,
  ],
})
export class SendAddEditComponent {
  /**
   * The header text for the component.
   */
  headerText: string;

  /**
   * The configuration for the send form.
   */
  config: SendFormConfig;

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private i18nService: I18nService,
    private addEditFormConfigService: SendFormConfigService,
    private sendApiService: SendApiService,
    private toastService: ToastService,
    private dialogService: DialogService,
    private router: Router,
  ) {
    this.subscribeToParams();
  }

  /**
   * Handles the event when the send is created.
   */
  async onSendCreated(send: SendView) {
    await this.router.navigate(["/send-created"], {
      queryParams: { sendId: send.id },
    });
    return;
  }

  /**
   * Handles the event when the send is updated.
   */
  async onSendUpdated(_: SendView) {
    await this.router.navigate(["/tabs/send"]);
  }

  deleteSend = async () => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteSend" },
      content: { key: "deleteSendPermanentConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.sendApiService.delete(this.config.originalSend?.id);
    } catch (e) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: e.message,
      });
      return;
    }

    this.location.back();

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("deletedSend"),
    });
  };

  /**
   * Subscribes to the route query parameters and builds the configuration based on the parameters.
   */
  subscribeToParams(): void {
    this.route.queryParams
      .pipe(
        takeUntilDestroyed(),
        map((params) => new QueryParams(params)),
        switchMap(async (params) => {
          let mode: SendFormMode;
          if (params.sendId == null) {
            mode = "add";
          } else {
            mode = "edit";
          }
          const config = await this.addEditFormConfigService.buildConfig(
            mode,
            params.sendId,
            params.type,
          );
          return config;
        }),
      )
      .subscribe((config) => {
        this.config = config;
        this.headerText = this.getHeaderText(config.mode, config.sendType);
      });
  }

  /**
   * Gets the header text based on the mode and type.
   * @param mode The mode of the send form.
   * @param type The type of the send
   * @returns The header text.
   */
  private getHeaderText(mode: SendFormMode, type: SendType) {
    const headerKey =
      mode === "edit" || mode === "partial-edit" ? "editItemHeader" : "newItemHeader";

    switch (type) {
      case SendType.Text:
        return this.i18nService.t(headerKey, this.i18nService.t("textSend"));
      case SendType.File:
        return this.i18nService.t(headerKey, this.i18nService.t("fileSend"));
    }
  }
}
