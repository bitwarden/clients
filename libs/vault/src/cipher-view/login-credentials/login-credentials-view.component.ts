// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule, DatePipe } from "@angular/common";
import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from "@angular/core";
import { Observable, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EventType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  FormFieldModule,
  SectionHeaderComponent,
  TypographyModule,
  LinkModule,
  IconButtonModule,
  BadgeModule,
  ColorPasswordModule,
} from "@bitwarden/components";

import { BitTotpCountdownComponent } from "../../components/totp-countdown/totp-countdown.component";
import { ReadOnlyCipherCardComponent } from "../read-only-cipher-card/read-only-cipher-card.component";

type TotpCodeValues = {
  totpCode: string;
  totpCodeFormatted?: string;
};

@Component({
  selector: "app-login-credentials-view",
  templateUrl: "login-credentials-view.component.html",
  imports: [
    CommonModule,
    JslibModule,
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
export class LoginCredentialsViewComponent implements OnChanges {
  @Input() cipher: CipherView;
  @Input() activeUserId: UserId;
  @Input() hadPendingChangePasswordTask: boolean;
  @Output() handleChangePassword = new EventEmitter<void>();

  isPremium$: Observable<boolean> = this.accountService.activeAccount$.pipe(
    switchMap((account) =>
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
    ),
  );
  showPasswordCount: boolean = false;
  passwordRevealed: boolean = false;
  totpCodeCopyObj: TotpCodeValues;

  private datePipe = inject(DatePipe);

  constructor(
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private i18nService: I18nService,
    private premiumUpgradeService: PremiumUpgradePromptService,
    private eventCollectionService: EventCollectionService,
    private accountService: AccountService,
  ) {}

  get fido2CredentialCreationDateValue(): string {
    const dateCreated = this.i18nService.t("dateCreated");
    const creationDate = this.datePipe.transform(
      this.cipher.login.fido2Credentials[0]?.creationDate,
      "short",
    );
    return `${dateCreated} ${creationDate}`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["cipher"]) {
      this.passwordRevealed = false;
      this.showPasswordCount = false;
    }
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

  launchChangePasswordEvent(): void {
    this.handleChangePassword.emit();
  }
}
