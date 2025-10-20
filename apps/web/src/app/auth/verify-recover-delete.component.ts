// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { first } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { VerifyDeleteRecoverRequest } from "@bitwarden/common/models/request/verify-delete-recover.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
 
@Component({
  selector: "app-verify-recover-delete",
  templateUrl: "verify-recover-delete.component.html",
  standalone: false,
})
export class VerifyRecoverDeleteComponent implements OnInit {
  email: string;

  private userId: string;
  private token: string;
  protected formGroup = new FormGroup({});

  constructor(
    private router: Router,
    private apiService: ApiService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private route: ActivatedRoute,
    private toastService: ToastService,
  ) {}

  ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
      if (qParams.userId != null && qParams.token != null && qParams.email != null) {
        this.userId = qParams.userId;
        this.token = qParams.token;
        this.email = qParams.email;
      } else {
        await this.router.navigate(["/"]);
      }
    });
  }

  submit = async () => {
    const request = new VerifyDeleteRecoverRequest(this.userId, this.token);
    await this.apiService.postAccountRecoverDeleteToken(request);
    this.toastService.showToast({
      variant: "success",
      title: this.i18nService.t("accountDeleted"),
      message: this.i18nService.t("accountDeletedDesc"),
    });
    await this.router.navigate(["/"]);
  };
}
