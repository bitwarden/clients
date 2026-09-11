// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule, DatePipe } from "@angular/common";
import {
  Component,
  ElementRef,
  EventEmitter,
  inject,
  input,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { Observable, switchMap } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
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
  ColorPasswordModule,
} from "@bitwarden/components";

import { BitTotpCountdownComponent } from "../../components/totp-countdown/totp-countdown.component";
import { ReadOnlyCipherCardComponent } from "../read-only-cipher-card/read-only-cipher-card.component";

type TotpCodeValues = {
  totpCode: string;
  totpCodeFormatted?: string;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
    ColorPasswordModule,
    BitTotpCountdownComponent,
    ReadOnlyCipherCardComponent,
    LinkModule,
    PremiumBadgeComponent,
  ],
})
export class LoginCredentialsViewComponent implements OnChanges {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() cipher: CipherView;
  protected readonly activeUserId = input<UserId | null>(null);
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showChangePasswordLink: boolean;
  readonly changePasswordLink = input<string | undefined>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() handleChangePassword = new EventEmitter<void>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("passwordInput")
  private passwordInput!: ElementRef<HTMLInputElement>;
  /**
   * Optional input for manually specifying whether the user can be considered
   * premium in anonymous environments where the userId is not available
   */
  readonly hasAnonymousPremium = input<boolean>(false);
  readonly hasAnonymousPremium$ = toObservable(this.hasAnonymousPremium);

  readonly activeUserId$ = toObservable(this.activeUserId);

  isPremium$: Observable<boolean> = this.activeUserId$.pipe(
    switchMap((userId) => {
      if (userId) {
        return this.billingAccountProfileStateService.hasPremiumFromAnySource$(userId);
      } else {
        return this.hasAnonymousPremium$;
      }
    }),
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
      if (this.passwordInput?.nativeElement) {
        // Reset password input type in case it's been toggled
        this.passwordInput.nativeElement.type = "password";
      }
      this.passwordRevealed = false;
      this.showPasswordCount = false;
    }
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
