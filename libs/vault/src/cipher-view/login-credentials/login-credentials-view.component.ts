// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule, DatePipe } from "@angular/common";
import { Component, inject, Input, OnInit } from "@angular/core";
import { combineLatest, map, Observable, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EventType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import {
  FormFieldModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
  LinkModule,
  IconButtonModule,
  BadgeModule,
  ColorPasswordModule,
} from "@bitwarden/components";
import { ChangeLoginPasswordService, DefaultTaskService } from "@bitwarden/vault";

import { BitTotpCountdownComponent } from "../../components/totp-countdown/totp-countdown.component";
import { ReadOnlyCipherCardComponent } from "../read-only-cipher-card/read-only-cipher-card.component";

type TotpCodeValues = {
  totpCode: string;
  totpCodeFormatted?: string;
};

@Component({
  selector: "app-login-credentials-view",
  templateUrl: "login-credentials-view.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
    FormFieldModule,
    IconButtonModule,
    BadgeModule,
    ColorPasswordModule,
    BitTotpCountdownComponent,
    ReadOnlyCipherCardComponent,
    LinkModule,
  ],
})
export class LoginCredentialsViewComponent implements OnInit {
  @Input() cipher: CipherView;
  @Input() activeUserId: UserId;

  isPremium$: Observable<boolean> = this.accountService.activeAccount$.pipe(
    switchMap((account) =>
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
    ),
  );
  showPasswordCount: boolean = false;
  passwordRevealed: boolean = false;
  totpCodeCopyObj: TotpCodeValues;
  hasPendingTasks$: Observable<boolean>;

  private datePipe = inject(DatePipe);

  constructor(
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private i18nService: I18nService,
    private premiumUpgradeService: PremiumUpgradePromptService,
    private eventCollectionService: EventCollectionService,
    private accountService: AccountService,
    private cipherAuthorizationService: CipherAuthorizationService,
    private defaultTaskService: DefaultTaskService,
    private platformUtilsService: PlatformUtilsService,
    private changeLoginPasswordService: ChangeLoginPasswordService,
  ) {}

  ngOnInit() {
    this.hasPendingTasks$ = combineLatest([
      this.defaultTaskService.pendingTasks$(this.activeUserId),
      this.cipherAuthorizationService.canManageCipher$(this.cipher),
    ]).pipe(
      map(([tasks, canManage]) => {
        let hasTasks = false;

        if (tasks?.length > 0) {
          hasTasks =
            tasks.filter((task) => {
              return task.cipherId === this.cipher.id;
            }).length > 0;
        }
        return hasTasks && canManage;
      }),
    );
  }

  launchChangePassword = async (cipher: CipherView) => {
    const url = await this.changeLoginPasswordService.getChangePasswordUrl(cipher);
    if (url == null) {
      return;
    }

    this.platformUtilsService.launchUri(url);
  };

  get fido2CredentialCreationDateValue(): string {
    const dateCreated = this.i18nService.t("dateCreated");
    const creationDate = this.datePipe.transform(
      this.cipher.login.fido2Credentials[0]?.creationDate,
      "short",
    );
    return `${dateCreated} ${creationDate}`;
  }

  async getPremium(organizationId?: string) {
    await this.premiumUpgradeService.promptForPremium(organizationId);
  }

  async pwToggleValue(passwordVisible: boolean) {
    this.passwordRevealed = passwordVisible;

    if (passwordVisible) {
      await this.eventCollectionService.collect(
        EventType.Cipher_ClientToggledPasswordVisible,
        this.cipher.id,
        false,
        this.cipher.organizationId,
      );
    }
  }

  togglePasswordCount() {
    this.showPasswordCount = !this.showPasswordCount;
  }

  setTotpCopyCode(e: TotpCodeValues) {
    this.totpCodeCopyObj = e;
  }

  async logCopyEvent() {
    await this.eventCollectionService.collect(
      EventType.Cipher_ClientCopiedPassword,
      this.cipher.id,
      false,
      this.cipher.organizationId,
    );
  }
}
