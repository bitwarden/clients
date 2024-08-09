import { CommonModule, Location } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Params } from "@angular/router";
import { map, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendId } from "@bitwarden/common/types/guid";
import { AsyncActionsModule, ButtonModule, SearchModule } from "@bitwarden/components";
import {
  DefaultSendFormConfigService,
  SendFormConfig,
  SendFormConfigService,
  SendFormMode,
} from "@bitwarden/send-ui";

import { SendFormModule } from "../../../../../../../libs/tools/send/send-ui/src/send-form/send-form.module";
import { PopupFooterComponent } from "../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";

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
  standalone: true,
  providers: [{ provide: SendFormConfigService, useClass: DefaultSendFormConfigService }],
  imports: [
    CommonModule,
    SearchModule,
    JslibModule,
    FormsModule,
    ButtonModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    SendFormModule,
    AsyncActionsModule,
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
  ) {
    this.subscribeToParams();
  }

  /**
   * Handles the event when the send is saved.
   */
  onSendSaved() {
    this.location.back();
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
        this.headerText = this.getHeaderText(config.mode, config.sendType);
      });
  }

  /**
   * Gets the header text based on the mode and type.
   * @param mode The mode of the send form.
   * @param type The type of the send form.
   * @returns The header text.
   */
  private getHeaderText(mode: SendFormMode, type: SendType) {
    const headerKey =
      mode === "edit" || mode === "partial-edit" ? "editItemHeader" : "newItemHeader";

    switch (type) {
      case SendType.Text:
        return this.i18nService.t(headerKey, this.i18nService.t("sendTypeText"));
      case SendType.File:
        return this.i18nService.t(headerKey, this.i18nService.t("sendTypeFile"));
    }
  }
}
