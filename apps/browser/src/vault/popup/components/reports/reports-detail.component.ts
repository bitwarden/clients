import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, firstValueFrom, map, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { AlertDismissalId, CipherId } from "@bitwarden/common/types/guid";
import { AlertDismissalService } from "@bitwarden/common/vault/alert-dismissals";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import { ButtonModule, DialogService, ItemModule, TypographyModule } from "@bitwarden/components";
import {
  ChangeLoginPasswordService,
  DefaultChangeLoginPasswordService,
  PasswordRepromptService,
} from "@bitwarden/vault";

import { CurrentAccountComponent } from "../../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";
import { PersonalVaultAlertService } from "../../services/personal-vault-alert.service";

export type ReportType = "exposed" | "weak" | "reused";

@Component({
  selector: "app-reports-detail",
  templateUrl: "./reports-detail.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    ButtonModule,
    ItemModule,
    TypographyModule,
  ],
  providers: [{ provide: ChangeLoginPasswordService, useClass: DefaultChangeLoginPasswordService }],
})
export class ReportsDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly alertService = inject(PersonalVaultAlertService);
  private readonly dismissalService = inject(AlertDismissalService);
  private readonly changePasswordService = inject(ChangeLoginPasswordService);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly platformUtils = inject(PlatformUtilsService);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);

  protected readonly dismissedOpen = signal(false);

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId, filterOutNullish());

  private readonly type$ = this.route.data.pipe(map((data) => data["type"] as ReportType));

  protected readonly ciphers$ = combineLatest([this.alertService.summary$, this.type$]).pipe(
    map(([summary, type]) => summary[type] as CipherView[]),
  );

  private readonly rawCiphersForType$ = combineLatest([
    this.alertService.rawSummary$,
    this.type$,
  ]).pipe(map(([summary, type]) => new Map((summary[type] as CipherView[]).map((c) => [c.id, c]))));

  private readonly dismissals$ = this.userId$.pipe(
    switchMap((userId) => this.dismissalService.dismissals$(userId)),
  );

  protected readonly dismissedItems$ = combineLatest([
    this.dismissals$,
    this.rawCiphersForType$,
  ]).pipe(
    map(([dismissals, cipherMap]) =>
      dismissals
        .filter((d) => cipherMap.has(d.cipherId as string))
        .map((d) => ({ dismissal: d, cipher: cipherMap.get(d.cipherId as string)! })),
    ),
  );

  protected readonly pageTitleKey$ = this.type$.pipe(
    map((type): string => {
      if (type === "exposed") {
        return "exposedPasswords";
      }
      if (type === "weak") {
        return "weakPasswords";
      }
      return "reusedPasswords";
    }),
  );

  async viewCipher(cipher: CipherView): Promise<void> {
    const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(cipher);
    if (!repromptPassed) {
      return;
    }
    await this.router.navigate(["/view-cipher"], {
      queryParams: { cipherId: cipher.id, type: cipher.type },
    });
  }

  async changePassword(cipher: CipherView): Promise<void> {
    const url = await this.changePasswordService.getChangePasswordUrl(cipher);
    if (url) {
      this.platformUtils.launchUri(url);
    }
  }

  async dismiss(cipherId: string): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: this.i18nService.t("dismissAlertQuestion"),
      content: this.i18nService.t("dismissAlertConfirmation"),
      type: "primary",
      icon: "bwi-eye-slash",
      acceptButtonText: this.i18nService.t("dismissAlert"),
      cancelButtonText: this.i18nService.t("cancel"),
    });
    if (!confirmed) {
      return;
    }
    const userId = await firstValueFrom(this.userId$);
    await this.dismissalService.dismiss(cipherId as CipherId, userId);
  }

  async undismiss(dismissalId: string): Promise<void> {
    const userId = await firstValueFrom(this.userId$);
    await this.dismissalService.undismiss(dismissalId as AlertDismissalId, userId);
  }

  toggleDismissed(): void {
    this.dismissedOpen.update((v) => !v);
  }
}
