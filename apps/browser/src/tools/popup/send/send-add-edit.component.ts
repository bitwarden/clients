import { DatePipe, Location } from "@angular/common";
import { Component } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { first } from "rxjs/operators";

import { AddEditComponent as BaseAddEditComponent } from "@bitwarden/angular/tools/send/add-edit.component";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { DialogService } from "@bitwarden/components";

import { BrowserStateService } from "../../../platform/services/abstractions/browser-state.service";
import { PopupUtilsService } from "../../../popup/services/popup-utils.service";

@Component({
  selector: "app-send-add-edit",
  templateUrl: "send-add-edit.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class SendAddEditComponent extends BaseAddEditComponent {
  // Options header
  showOptions = false;
  // File visibility
  isFirefox = false;
  inPopout = false;
  inSidebar = false;
  isLinux = false;
  isUnsupportedMac = false;

  constructor(
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    stateService: BrowserStateService,
    messagingService: MessagingService,
    policyService: PolicyService,
    environmentService: EnvironmentService,
    datePipe: DatePipe,
    sendService: SendService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private popupUtilsService: PopupUtilsService,
    logService: LogService,
    sendApiService: SendApiService,
    dialogService: DialogService,
    formBuilder: FormBuilder
  ) {
    super(
      i18nService,
      platformUtilsService,
      environmentService,
      datePipe,
      sendService,
      messagingService,
      policyService,
      logService,
      stateService,
      sendApiService,
      dialogService,
      formBuilder
    );
  }

  get showFileSelector(): boolean {
    return !(this.editMode || this.showFilePopoutMessage);
  }

  get showFilePopoutMessage(): boolean {
    return (
      !this.editMode &&
      (this.showFirefoxFileWarning || this.showSafariFileWarning || this.showChromiumFileWarning)
    );
  }

  get showFirefoxFileWarning(): boolean {
    return this.isFirefox && !(this.inSidebar || this.inPopout);
  }

  get showSafariFileWarning(): boolean {
    return this.isSafari && !this.inPopout;
  }

  // Only show this for Chromium based browsers in Linux and Mac > Big Sur
  get showChromiumFileWarning(): boolean {
    return (
      (this.isLinux || this.isUnsupportedMac) &&
      !this.isFirefox &&
      !(this.inSidebar || this.inPopout)
    );
  }

  popOutWindow() {
    this.popupUtilsService.popOut(window);
  }

  async ngOnInit() {
    // File visibility
    this.isFirefox = this.platformUtilsService.isFirefox();
    this.inPopout = this.popupUtilsService.inPopout(window);
    this.inSidebar = this.popupUtilsService.inSidebar(window);
    this.isLinux = window?.navigator?.userAgent.indexOf("Linux") !== -1;
    this.isUnsupportedMac =
      this.platformUtilsService.isChrome() && window?.navigator?.appVersion.includes("Mac OS X 11");

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (params) => {
      if (params.sendId) {
        this.sendId = params.sendId;
      }
      if (params.type) {
        const type = parseInt(params.type, null);
        this.type = type;
      }
      await super.ngOnInit();
    });

    window.setTimeout(() => {
      if (!this.editMode) {
        document.getElementById("name").focus();
      }
    }, 200);
  }

  async submit(): Promise<boolean> {
    if (await super.submit()) {
      this.cancel();
      return true;
    }

    return false;
  }

  async delete(): Promise<boolean> {
    if (await super.delete()) {
      this.cancel();
      return true;
    }

    return false;
  }

  cancel() {
    // If true, the window was pop'd out on the add-send page. location.back will not work
    if ((window as any).previousPopupUrl.startsWith("/add-send")) {
      this.router.navigate(["tabs/send"]);
    } else {
      this.location.back();
    }
  }
}
