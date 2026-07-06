// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule, Location } from "@angular/common";
import { Component, inject, signal, viewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { firstValueFrom, map, switchMap } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { WhoCanAccessType } from "@bitwarden/common/tools/models/send-who-can-access-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { SendId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  ButtonComponent,
  ButtonModule,
  CalloutComponent,
  DialogService,
  IconButtonModule,
  SearchModule,
  ToastService,
} from "@bitwarden/components";
import {
  DefaultSendFormConfigService,
  SendFormConfig,
  SendFormConfigService,
  SendFormComponent,
  SendFormGenerationService,
  SendFormMode,
  SendFormModule,
  SendFormService,
  SendPolicyService,
} from "@bitwarden/send-ui";
import { I18nPipe } from "@bitwarden/ui-common";

import { PopupFooterComponent } from "../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";
import { BrowserSendFormGenerationService } from "../services/browser-send-form-generation.service";

/**
 * Helper class to parse query parameters for the AddEdit route.
 */
class QueryParams {
  constructor(params: Params) {
    this.sendId = params.sendId;
    const sendTypeValue = parseInt(params.type, 10);
    if (sendTypeValue === SendType.Text || sendTypeValue === SendType.File) {
      this.type = sendTypeValue;
    } else {
      throw new Error(`Invalid SendType: ${params.type}`);
    }
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
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-send-add-edit",
  templateUrl: "send-add-edit.component.html",
  providers: [
    { provide: SendFormConfigService, useClass: DefaultSendFormConfigService },
    { provide: SendFormGenerationService, useClass: BrowserSendFormGenerationService },
  ],
  imports: [
    CommonModule,
    SearchModule,
    I18nPipe,
    FormsModule,
    ButtonModule,
    IconButtonModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    SendFormModule,
    AsyncActionsModule,
    CalloutComponent,
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

  /**
   * Whether the Send is actively being edited
   */
  protected readonly editing = signal(false);

  private sendFormGenerationService = inject(SendFormGenerationService);
  private readonly sendFormComponent = viewChild(SendFormComponent);
  readonly submitBtn = viewChild<ButtonComponent>("submitBtn");

  protected readonly showCopyButton = signal(false);
  protected readonly showTrashIconButton = signal(false);

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private i18nService: I18nService,
    private addEditFormConfigService: SendFormConfigService,
    private sendApiService: SendApiService,
    private toastService: ToastService,
    private dialogService: DialogService,
    private router: Router,
    private sendFormService: SendFormService,
    private sendPolicyService: SendPolicyService,
  ) {
    this.subscribeToParams();
  }

  /**
   * Handles the event when the send is created.
   */
  async onSendCreated(send: SendView) {
    await this.router.navigate(["/send-created"], {
      queryParams: { sendId: send.id },
      replaceUrl: true,
    });
    return;
  }

  /**
   * Handles the event when the send is updated.
   */
  async onSendUpdated(updatedSendView: SendView) {
    await this.router.navigate(["/edit-send"], {
      queryParams: { sendId: updatedSendView.id, type: updatedSendView.type },
    });
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
   * Opens the password generator dialog and sets the generated value on the password field.
   */
  async openGenerator() {
    const password = await this.sendFormGenerationService.generatePassword();
    if (password) {
      this.sendFormComponent()?.sendDetailsComponent()?.setGeneratedPassword(password);
    }
  }

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
        this.editing.set(config.mode === "add");
        this.headerText = this.getHeaderText(config.mode, config.sendType);
        this.showCopyButton.set(
          this.config.originalSend?.disabled && this.config.originalSend?.type === SendType.Text,
        );
        this.showTrashIconButton.set(
          this.showCopyButton() || (!config.originalSend?.disabled && config?.mode !== "add"),
        );
      });
  }

  /**
   * Gets the header text based on the mode and type.
   * @param mode The mode of the send form.
   * @param type The type of the send
   * @returns The header text.
   */
  private getHeaderText(mode: SendFormMode, type: SendType) {
    let sendAction: "view" | "edit" | "add" = "add";
    if (!this.editing()) {
      sendAction = "view";
    } else if (mode === "edit" || mode === "partial-edit") {
      sendAction = "edit";
    }
    const translation = {
      [SendType.Text]: {
        view: "viewTextSendHeader",
        edit: "editItemHeaderTextSendV2",
        add: "newItemHeaderTextSendV2",
      },
      [SendType.File]: {
        view: "viewFileSendHeader",
        edit: "editItemHeaderFileSendV2",
        add: "newItemHeaderFileSendV2",
      },
    };
    return this.i18nService.t(translation[type][sendAction]);
  }

  protected editSend() {
    this.editing.set(true);
    this.headerText = this.getHeaderText(this.config.mode, this.config.sendType);
  }

  protected async onCancelClick() {
    if (this.config.mode === "add") {
      await this.router.navigate(["tabs/send"]);
    } else {
      this.editing.set(false);
      this.headerText = this.getHeaderText(this.config.mode, this.config.sendType);
    }
  }

  protected async onBackClick() {
    if (this.config.mode === "add" || !this.editing()) {
      await this.router.navigate(["tabs/send"]);
    } else {
      await this.onCancelClick();
    }
  }

  protected async makeCopy() {
    const originalSendView = this.sendFormService.originalSendView();
    if (!originalSendView) {
      return;
    }
    const hideEmailDisabled = await firstValueFrom(this.sendPolicyService.disableHideEmail$);
    const whoCanAccess = await firstValueFrom(this.sendPolicyService.whoCanAccess$);
    this.config = {
      areSendsAllowed: true,
      mode: "add",
      sendType: originalSendView.type,
      originalSend: null,
      presetSendFields: {
        name: originalSendView.name,
        text: originalSendView.text,
        maxAccessCount: originalSendView.maxAccessCount,
        hideEmail: !hideEmailDisabled && originalSendView.hideEmail,
        notes: originalSendView.notes,
        authType:
          whoCanAccess === WhoCanAccessType.SpecificPeople
            ? AuthType.Email
            : whoCanAccess === WhoCanAccessType.PasswordProtected
              ? AuthType.Password
              : AuthType.None,
      },
    };
    this.editSend();
  }
}
