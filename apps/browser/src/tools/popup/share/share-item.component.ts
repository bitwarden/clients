import { Location } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, viewChild } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { ButtonModule, IconModule } from "@bitwarden/components";
import { ShareItemFormComponent } from "@bitwarden/tools-share";
import { I18nPipe } from "@bitwarden/ui-common";

import { PopupFooterComponent } from "../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  selector: "app-share-item",
  templateUrl: "share-item.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    ButtonModule,
    I18nPipe,
    ShareItemFormComponent,
    IconModule,
  ],
})
export class ShareItemComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  protected readonly cipher = toSignal(
    combineLatest([this.route.queryParams, this.activeUserId$]).pipe(
      switchMap(([qp, userId]) => {
        if (qp.cipherId && userId) {
          return this.cipherService.cipherView$(userId, qp.cipherId);
        } else {
          return of(undefined);
        }
      }),
    ),
    { initialValue: undefined },
  );
  protected readonly shareItemForm = viewChild(ShareItemFormComponent);

  protected async createAndCopyLink(): Promise<void> {
    const copySuccessful = await this.shareItemForm()?.createAndCopyLink();
    if (copySuccessful) {
      this.onBackClick();
    }
  }

  protected onBackClick(): void {
    this.location.back();
  }
}
