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
  computed,
} from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { Observable, switchMap } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { RiskCategory } from "@bitwarden/common/dirt/vault-health/models";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeComponent,
  BadgeVariant,
  BitwardenIcon,
  FormFieldModule,
  SectionHeaderComponent,
  TypographyModule,
  LinkModule,
  IconButtonModule,
  ColorPasswordModule,
} from "@bitwarden/components";

import { BitTotpCountdownComponent } from "../../components/totp-countdown/totp-countdown.component";
import { ReadOnlyCipherCardComponent } from "../read-only-cipher-card/read-only-cipher-card.component";

type RiskBadge = {
  labelKey: string;
  tooltipKey: string;
  icon: BitwardenIcon;
  variant: BadgeVariant;
};

/** Badge styling per risk category; icons and colors match the Health tab. */
const RISK_BADGES: Record<RiskCategory, RiskBadge> = {
  [RiskCategory.Exposed]: {
    labelKey: "exposed",
    tooltipKey: "passwordExposedInDataBreach",
    icon: "bwi-error",
    variant: "danger",
  },
  [RiskCategory.Weak]: {
    labelKey: "weak",
    tooltipKey: "passwordTooShortOrSimple",
    icon: "bwi-warning",
    variant: "warning",
  },
  [RiskCategory.Reused]: {
    labelKey: "reused",
    tooltipKey: "passwordReusedForSeveralLogins",
    icon: "bwi-refresh",
    variant: "primary",
  },
};

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
    BadgeComponent,
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
  readonly passwordRiskCategory = input<RiskCategory | null>(null);
  protected readonly riskBadge = computed(() => {
    const category = this.passwordRiskCategory();
    return category ? RISK_BADGES[category] : null;
  });
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
    private eventCollectionService: EventCollectionService,
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
