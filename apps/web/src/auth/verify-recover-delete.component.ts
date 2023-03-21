import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { first } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { VerifyDeleteRecoverRequest } from "@bitwarden/common/models/request/verify-delete-recover.request";
import { Guid } from "@bitwarden/common/types/guid";

@Component({
  selector: "app-verify-recover-delete",
  templateUrl: "verify-recover-delete.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class VerifyRecoverDeleteComponent implements OnInit {
  email: string;
  formPromise: Promise<any>;

  private userId: Guid;
  private token: string;

  constructor(
    private router: Router,
    private apiService: ApiService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private route: ActivatedRoute,
    private logService: LogService
  ) {}

  ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
      if (qParams.userId != null && qParams.token != null && qParams.email != null) {
        this.userId = qParams.userId;
        this.token = qParams.token;
        this.email = qParams.email;
      } else {
        this.router.navigate(["/"]);
      }
    });
  }

  async submit() {
    try {
      const request = new VerifyDeleteRecoverRequest(this.userId, this.token);
      this.formPromise = this.apiService.postAccountRecoverDeleteToken(request);
      await this.formPromise;
      this.platformUtilsService.showToast(
        "success",
        this.i18nService.t("accountDeleted"),
        this.i18nService.t("accountDeletedDesc")
      );
      this.router.navigate(["/"]);
    } catch (e) {
      this.logService.error(e);
    }
  }
}
