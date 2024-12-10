// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgIf } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { first } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherId } from "@bitwarden/common/types/guid";

import { PasswordHistoryViewComponent } from "../../../../../../../../libs/vault/src/components/password-history-view/password-history-view.component";
import { PopOutComponent } from "../../../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";
import { PopupRouterCacheService } from "../../../../../platform/popup/view-cache/popup-router-cache.service";

@Component({
  standalone: true,
  selector: "vault-password-history-v2",
  templateUrl: "vault-password-history-v2.component.html",
  imports: [
    JslibModule,
    PopupPageComponent,
    PopOutComponent,
    PopupHeaderComponent,
    PasswordHistoryViewComponent,
    NgIf,
  ],
})
export class PasswordHistoryV2Component implements OnInit {
  protected cipherId: CipherId;

  constructor(
    private browserRouterHistory: PopupRouterCacheService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.route.queryParams.pipe(first()).subscribe((params) => {
      if (params.cipherId) {
        this.cipherId = params.cipherId;
      } else {
        this.close();
      }
    });
  }

  close() {
    void this.browserRouterHistory.back();
  }
}
