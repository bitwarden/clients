// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import {
  first,
  lastValueFrom,
  Observable,
  Subject,
  Subscription,
  takeUntil,
  switchMap,
} from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TwoFactorAuthenticatorResponse } from "@bitwarden/common/auth/models/response/two-factor-authenticator.response";
import { TwoFactorDuoResponse } from "@bitwarden/common/auth/models/response/two-factor-duo.response";
import { TwoFactorEmailResponse } from "@bitwarden/common/auth/models/response/two-factor-email.response";
import { TwoFactorWebAuthnResponse } from "@bitwarden/common/auth/models/response/two-factor-web-authn.response";
import { TwoFactorYubiKeyResponse } from "@bitwarden/common/auth/models/response/two-factor-yubi-key.response";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { TwoFactorProviders } from "@bitwarden/common/auth/services/two-factor.service";
import { TwoFactorApiService } from "@bitwarden/common/auth/two-factor";
import { AuthResponse } from "@bitwarden/common/auth/types/auth-response";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { DialogRef, DialogService, ItemModule } from "@bitwarden/components";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared/shared.module";

import { TwoFactorRecoveryComponent } from "./two-factor-recovery.component";
import { TwoFactorSetupAuthenticatorComponent } from "./two-factor-setup-authenticator.component";
import { TwoFactorSetupDuoComponent } from "./two-factor-setup-duo.component";
import { TwoFactorSetupEmailComponent } from "./two-factor-setup-email.component";
import { TwoFactorSetupWebAuthnComponent } from "./two-factor-setup-webauthn.component";
import { TwoFactorSetupYubiKeyComponent } from "./two-factor-setup-yubikey.component";
import { TwoFactorVerifyComponent } from "./two-factor-verify.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-two-factor-setup",
  templateUrl: "two-factor-setup.component.html",
  imports: [ItemModule, HeaderModule, PremiumBadgeComponent, SharedModule],
})
export class TwoFactorSetupComponent implements OnInit, OnDestroy {
  organizationId: string;
  organization: Organization;
  providers: any[] = [];
  canAccessPremium$: Observable<boolean>;
  recoveryCodeWarningMessage: string;
  showPolicyWarning = false;
  loading = true;
  formPromise: Promise<any>;

  tabbedHeader = true;

  protected destroy$ = new Subject<void>();
  private twoFactorAuthPolicyAppliesToActiveUser: boolean;
  protected twoFactorSetupSubscription: Subscription;

  constructor(
    protected dialogService: DialogService,
    protected twoFactorApiService: TwoFactorApiService,
    protected messagingService: MessagingService,
    protected policyService: PolicyService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    protected accountService: AccountService,
    protected configService: ConfigService,
    protected i18nService: I18nService,
  ) {
    this.canAccessPremium$ = this.accountService.activeAccount$.pipe(
      switchMap((account) =>
        billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
      ),
    );
  }

  async ngOnInit() {
    this.recoveryCodeWarningMessage = this.i18nService.t("yourSingleUseRecoveryCode");

    for (const key in TwoFactorProviders) {
      // eslint-disable-next-line
      if (!TwoFactorProviders.hasOwnProperty(key)) {
        continue;
      }

      const p = (TwoFactorProviders as any)[key];
      if (this.filterProvider(p.type)) {
        continue;
      }

      this.providers.push({
        type: p.type,
        name: p.name,
        description: p.description,
        enabled: false,
        premium: p.premium,
        sort: p.sort,
      });
    }

    this.providers.sort((a: any, b: any) => a.sort - b.sort);

    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) =>
          this.policyService.policyAppliesToUser$(PolicyType.TwoFactorAuthentication, userId),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((policyAppliesToActiveUser) => {
        this.twoFactorAuthPolicyAppliesToActiveUser = policyAppliesToActiveUser;
      });
    await this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async load() {
    this.loading = true;
    const providerList = await this.getTwoFactorProviders();
    providerList.data.forEach((p) => {
      this.providers.forEach((p2) => {
        if (p.type === p2.type) {
          p2.enabled = p.enabled;
        }
      });
    });
    this.evaluatePolicies();
    this.loading = false;
  }

  async callTwoFactorVerifyDialog(type?: TwoFactorProviderType) {
    const twoFactorVerifyDialogRef = TwoFactorVerifyComponent.open(this.dialogService, {
      data: { type: type, organizationId: this.organizationId },
    });
    return await lastValueFrom(twoFactorVerifyDialogRef.closed);
  }

  async manage(type: TwoFactorProviderType) {
    // clear any existing subscriptions before creating a new one
    this.twoFactorSetupSubscription?.unsubscribe();

    switch (type) {
      case TwoFactorProviderType.Authenticator: {
        const result: AuthResponse<TwoFactorAuthenticatorResponse> =
          await this.callTwoFactorVerifyDialog(type);
        if (!result) {
          return;
        }
        const authComp: DialogRef<boolean, any> = TwoFactorSetupAuthenticatorComponent.open(
          this.dialogService,
          { data: result },
        );
        this.twoFactorSetupSubscription = authComp.componentInstance.onChangeStatus
          .pipe(first(), takeUntil(this.destroy$))
          .subscribe((enabled: boolean) => {
            authComp.close();
            this.updateStatus(enabled, TwoFactorProviderType.Authenticator);
          });
        break;
      }
      case TwoFactorProviderType.Yubikey: {
        const result: AuthResponse<TwoFactorYubiKeyResponse> =
          await this.callTwoFactorVerifyDialog(type);
        if (!result) {
          return;
        }
        const yubiComp: DialogRef<boolean, any> = TwoFactorSetupYubiKeyComponent.open(
          this.dialogService,
          { data: result },
        );
        yubiComp.componentInstance.onUpdated
          .pipe(takeUntil(this.destroy$))
          .subscribe((enabled: boolean) => {
            this.updateStatus(enabled, TwoFactorProviderType.Yubikey);
          });
        break;
      }
      case TwoFactorProviderType.Duo: {
        const result: AuthResponse<TwoFactorDuoResponse> =
          await this.callTwoFactorVerifyDialog(type);
        if (!result) {
          return;
        }
        const duoComp: DialogRef<boolean, any> = TwoFactorSetupDuoComponent.open(
          this.dialogService,
          {
            data: {
              authResponse: result,
            },
          },
        );
        this.twoFactorSetupSubscription = duoComp.componentInstance.onChangeStatus
          .pipe(first(), takeUntil(this.destroy$))
          .subscribe((enabled: boolean) => {
            duoComp.close();
            this.updateStatus(enabled, TwoFactorProviderType.Duo);
          });
        break;
      }
      case TwoFactorProviderType.Email: {
        const result: AuthResponse<TwoFactorEmailResponse> =
          await this.callTwoFactorVerifyDialog(type);
        if (!result) {
          return;
        }
        const emailComp: DialogRef<boolean, any> = TwoFactorSetupEmailComponent.open(
          this.dialogService,
          {
            data: result,
          },
        );
        this.twoFactorSetupSubscription = emailComp.componentInstance.onChangeStatus
          .pipe(first(), takeUntil(this.destroy$))
          .subscribe((enabled: boolean) => {
            emailComp.close();
            this.updateStatus(enabled, TwoFactorProviderType.Email);
          });
        break;
      }
      case TwoFactorProviderType.WebAuthn: {
        const result: AuthResponse<TwoFactorWebAuthnResponse> =
          await this.callTwoFactorVerifyDialog(type);
        if (!result) {
          return;
        }
        const webAuthnComp: DialogRef<boolean, any> = TwoFactorSetupWebAuthnComponent.open(
          this.dialogService,
          { data: result },
        );
        this.twoFactorSetupSubscription = webAuthnComp.componentInstance.onUpdated
          .pipe(first(), takeUntil(this.destroy$))
          .subscribe((enabled: boolean) => {
            webAuthnComp.close();
            this.updateStatus(enabled, TwoFactorProviderType.WebAuthn);
          });
        break;
      }
      default:
        break;
    }
  }

  async recoveryCode() {
    const result = await this.callTwoFactorVerifyDialog(-1 as TwoFactorProviderType);
    if (result) {
      const recoverComp = TwoFactorRecoveryComponent.open(this.dialogService, { data: result });
      await lastValueFrom(recoverComp.closed);
    }
  }

  protected getTwoFactorProviders() {
    return this.twoFactorApiService.getTwoFactorProviders();
  }

  protected filterProvider(type: TwoFactorProviderType): boolean {
    return type === TwoFactorProviderType.OrganizationDuo;
  }

  protected updateStatus(enabled: boolean, type: TwoFactorProviderType) {
    this.providers.forEach((p) => {
      if (p.type === type && enabled !== undefined) {
        p.enabled = enabled;
      }
    });
    this.evaluatePolicies();
  }

  private evaluatePolicies() {
    if (this.organizationId == null && this.providers.filter((p) => p.enabled).length === 1) {
      this.showPolicyWarning = this.twoFactorAuthPolicyAppliesToActiveUser;
    } else {
      this.showPolicyWarning = false;
    }
  }

  get isEnterpriseOrg() {
    return this.organization?.productTierType === ProductTierType.Enterprise;
  }
}
