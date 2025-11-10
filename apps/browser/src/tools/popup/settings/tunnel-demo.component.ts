import { Component, OnInit } from "@angular/core";

import { DialogService } from "@bitwarden/components";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  standalone: true,
  selector: "tunnel-demo",
  templateUrl: "tunnel-demo.component.html",
  imports: [PopOutComponent, PopupHeaderComponent, PopupPageComponent],
})
export class TunnelDemoComponent implements OnInit {
  constructor(private dialogService: DialogService) {}

  async ngOnInit() {
    await this.showDemoModal();
  }

  async showDemoModal() {
    await this.dialogService.openSimpleDialog({
      title: { key: "tunnelDemoTitle" },
      content: { key: "tunnelDemoContent" },
      type: "info",
      acceptButtonText: { key: "ok" },
      cancelButtonText: null,
    });
  }
}
