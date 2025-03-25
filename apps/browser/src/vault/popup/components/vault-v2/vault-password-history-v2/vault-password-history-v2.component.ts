// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgIf } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { first, map } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PasswordHistoryViewComponent } from "@bitwarden/vault";

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
  protected cipher: CipherView;

  constructor(
    private browserRouterHistory: PopupRouterCacheService,
    private route: ActivatedRoute,
    private cipherService: CipherService,
    private accountService: AccountService,
  ) {}

  ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.route.queryParams.pipe(first()).subscribe((params) => {
      if (params.cipherId) {
        void this.loadCipher(params.cipherId);
      } else {
        this.close();
      }
    });
  }

  close() {
    void this.browserRouterHistory.back();
  }

  /** Load the cipher based on the given Id */
  private async loadCipher(cipherId: string) {
    const activeAccount = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a: { id: string | undefined }) => a)),
    );

    if (!activeAccount?.id) {
      throw new Error("Active account is not available.");
    }

    const activeUserId = activeAccount.id as UserId;

    const cipher = await this.cipherService.get(cipherId, activeUserId);
    this.cipher = await cipher.decrypt(
      await this.cipherService.getKeyForCipherKeyDecryption(cipher, activeUserId),
    );
  }
}
