import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";
import { Subject, switchMap, takeUntil } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DialogService } from "@bitwarden/components";

import { WebauthnLoginAdminService } from "../../core";
import { WebauthnLoginCredentialPrfStatus } from "../../core/enums/webauthn-login-credential-prf-status.enum";
import { WebauthnLoginCredentialView } from "../../core/views/webauthn-login-credential.view";

import { openCreateCredentialDialog } from "./create-credential-dialog/create-credential-dialog.component";
import { openDeleteCredentialDialogComponent } from "./delete-credential-dialog/delete-credential-dialog.component";
import { openEnableCredentialDialogComponent } from "./enable-encryption-dialog/enable-encryption-dialog.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-webauthn-login-settings",
  templateUrl: "webauthn-login-settings.component.html",
  host: {
    "aria-live": "polite",
  },
  standalone: false,
})
export class WebauthnLoginSettingsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  protected readonly MaxCredentialCount = WebauthnLoginAdminService.MaxCredentialCount;
  protected readonly WebauthnLoginCredentialPrfStatus = WebauthnLoginCredentialPrfStatus;

  protected credentials?: WebauthnLoginCredentialView[];
  protected loading = true;

  protected requireSsoPolicyEnabled = false;

  constructor(
    private webauthnService: WebauthnLoginAdminService,
    private dialogService: DialogService,
    private policyService: PolicyService,
    private accountService: AccountService,
  ) {}

  ngOnInit(): void {
    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) =>
          this.policyService.policyAppliesToUser$(PolicyType.RequireSso, userId),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((enabled) => {
        this.requireSsoPolicyEnabled = enabled;
      });

    this.webauthnService
      .getCredentials$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((credentials) => (this.credentials = credentials));

    this.webauthnService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => (this.loading = loading));
  }

  @HostBinding("attr.aria-busy")
  get ariaBusy() {
    return this.loading ? "true" : "false";
  }

  get hasCredentials() {
    return (this.credentials?.length ?? 0) > 0;
  }

  get hasData() {
    return this.credentials !== undefined;
  }

  get limitReached() {
    return (this.credentials?.length ?? 0) >= this.MaxCredentialCount;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected createCredential() {
    openCreateCredentialDialog(this.dialogService, {});
  }

  protected deleteCredential(credentialId: string) {
    openDeleteCredentialDialogComponent(this.dialogService, { data: { credentialId } });
  }

  protected enableEncryption(credentialId: string) {
    openEnableCredentialDialogComponent(this.dialogService, { data: { credentialId } });
  }
}
