import { Location } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ButtonModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { ShareItemFormComponent } from "@bitwarden/vault";

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
  ],
})
export class ShareItemComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);

  protected readonly cipher = signal<CipherView | null>(null);
  protected readonly shareItemForm = viewChild.required(ShareItemFormComponent);

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  constructor() {
    this.route.queryParams
      .pipe(
        takeUntilDestroyed(),
        switchMap((params) => {
          const cipherId = params.cipherId as CipherId;
          return this.activeUserId$.pipe(
            switchMap((userId) => this.cipherService.cipherView$(userId, cipherId)),
          );
        }),
      )
      .subscribe((cipherView) => {
        if (cipherView) {
          this.cipher.set(cipherView);
        }
      });
  }

  protected async createAndCopyLink(): Promise<void> {
    await this.shareItemForm().createAndCopyLink();
  }

  protected onBackClick(): void {
    this.location.back();
  }
}
