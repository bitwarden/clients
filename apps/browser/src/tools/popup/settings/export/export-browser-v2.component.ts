import { CommonModule } from "@angular/common";
import { Component, Input, inject } from "@angular/core";
import { Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  FunctionReturningAwaitable,
} from "@bitwarden/components";
import { ExportComponent } from "@bitwarden/vault-export-ui";

import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";
import { PopupRouterCacheService } from "../../../../platform/popup/view-cache/popup-router-cache.service";

@Component({
  templateUrl: "export-browser-v2.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    AsyncActionsModule,
    ButtonModule,
    ExportComponent,
    PopupPageComponent,
    PopupFooterComponent,
    PopupHeaderComponent,
    PopOutComponent,
  ],
})
export class ExportBrowserV2Component {
  protected disabled = false;
  protected loading = false;

  private popupRouterCacheService = inject(PopupRouterCacheService);

  constructor(private router: Router) {}

  protected async onSuccessfulExport(organizationId: string): Promise<void> {
    await this.router.navigate(["/vault-settings"]);
  }

  /**
   * Async action that occurs when clicking the cancel button
   *
   * If unset, will call `location.back()`
   **/
  @Input()
  cancelAction: FunctionReturningAwaitable = async () => {
    return this.popupRouterCacheService.back();
  };
}
