import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CalloutModule } from "@bitwarden/components";

import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { FilePopoutUtilsService } from "../services/file-popout-utils.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-file-popout-callout",
  templateUrl: "file-popout-callout.component.html",
  imports: [CommonModule, JslibModule, CalloutModule],
})
export class FilePopoutCalloutComponent implements OnInit {
  protected showFilePopoutMessage: boolean = false;
  protected showFirefoxFileWarning: boolean = false;
  protected showSafariFileWarning: boolean = false;
  protected showChromiumFileWarning: boolean = false;

  constructor(private filePopoutUtilsService: FilePopoutUtilsService) {}

  ngOnInit() {
    this.showFilePopoutMessage = this.filePopoutUtilsService.showFilePopoutMessage(window);
    this.showFirefoxFileWarning = this.filePopoutUtilsService.showFirefoxFileWarning(window);
    this.showSafariFileWarning = this.filePopoutUtilsService.showSafariFileWarning(window);
    this.showChromiumFileWarning = this.filePopoutUtilsService.showChromiumFileWarning(window);
  }

  popOutWindow() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    BrowserPopupUtils.openCurrentPagePopout(window);
  }
}
