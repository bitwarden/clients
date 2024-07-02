import { DatePipe, Location } from "@angular/common";
import { Component } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { first } from "rxjs/operators";

import { AddEditComponent as BaseAddEditComponent } from "@bitwarden/angular/tools/send/add-edit.component";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";

import BrowserPopupUtils from "../../../platform/popup/browser-popup-utils";
import { FilePopoutUtilsService } from "../services/file-popout-utils.service";

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
  showFileSelector = false;

  constructor(
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    stateService: StateService,
    messagingService: MessagingService,
    policyService: PolicyService,
    environmentService: EnvironmentService,
    datePipe: DatePipe,
    sendService: SendService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    logService: LogService,
    sendApiService: SendApiService,
    dialogService: DialogService,
    formBuilder: FormBuilder,
    private filePopoutUtilsService: FilePopoutUtilsService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    accountService: AccountService,
    toastService: ToastService,
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
      formBuilder,
      billingAccountProfileStateService,
      accountService,
      toastService,
    );
  }

  popOutWindow() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    BrowserPopupUtils.openCurrentPagePopout(window);
  }

  async ngOnInit() {
    // File visibility
    this.showFileSelector =
      !this.editMode && !this.filePopoutUtilsService.showFilePopoutMessage(window);
    this.inPopout = BrowserPopupUtils.inPopout(window);
    this.isFirefox = this.platformUtilsService.isFirefox();

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
    const isPopup = (window as any)?.previousPopupUrl?.startsWith("/add-send") ?? false;
    if (!isPopup) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["tabs/send"]);
    } else {
      this.location.back();
    }
  }
}
