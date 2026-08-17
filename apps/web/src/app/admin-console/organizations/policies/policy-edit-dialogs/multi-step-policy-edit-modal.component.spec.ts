// bit-dialog uses IntersectionObserver, which isn't available in jsdom.
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
})) as any;

import { DialogRef as CdkDialogRef } from "@angular/cdk/dialog";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { NEVER, of } from "rxjs";

import { AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService } from "@bitwarden/legacy-crypto";

import {
  AutoConfirmPolicy,
  AutoConfirmPolicyEditComponent,
} from "../policy-edit-definitions/auto-confirm-policy.component";
import { PolicyEditDialogData, PolicyEditDialogResult } from "../policy-edit-drawer.component";

import { MultiStepPolicyEditModalComponent } from "./multi-step-policy-edit-modal.component";

describe("MultiStepPolicyEditModalComponent", () => {
  /**
   * Renders the REAL AutoConfirmPolicy through the REAL modal component (not test doubles), the
   * same way it's opened by WebVaultPromptService for the vault-page first-time onboarding prompt.
   */
  async function setupModal(firstTimeDialog = false) {
    const data: PolicyEditDialogData = {
      policy: new AutoConfirmPolicy(firstTimeDialog),
      organization: {
        id: "org-1",
        keyConnectorEnabled: false,
        useMyItems: false,
      } as Organization,
    };

    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: any) => key);
    const policyApiService = mock<PolicyApiServiceAbstraction>();
    policyApiService.getPolicy.mockResolvedValue(new PolicyResponse({ Enabled: false }));
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "user-1", email: "user@example.com" } as any);
    const organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(
      of([{ id: "org-1", keyConnectorEnabled: false, useMyItems: false } as any]),
    );
    const dRef = mock<DialogRef<PolicyEditDialogResult>>();
    const authService = mock<AuthService>();
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));
    const policyService = mock<PolicyService>();
    policyService.policies$.mockReturnValue(of([]));
    const router = mock<Router>();
    // DrawerService reads router.url synchronously at construction time.
    (router as any).url = "/";
    (router as any).events = NEVER;

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: AccountService, useValue: accountService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: AuthService, useValue: authService },
        { provide: PolicyApiServiceAbstraction, useValue: policyApiService },
        { provide: I18nService, useValue: i18n },
        { provide: DialogRef, useValue: dRef },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: CdkDialogRef, useValue: { backdropClick: NEVER, keydownEvents: NEVER } },
        { provide: EncryptService, useValue: mock<EncryptService>() },
        { provide: PolicyService, useValue: policyService },
        {
          provide: AutomaticUserConfirmationService,
          useValue: mock<AutomaticUserConfirmationService>(),
        },
        { provide: Router, useValue: router },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(MultiStepPolicyEditModalComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    // The async ngAfterViewInit chain (load() -> createComponent()) resolves signal writes
    // (loading, policyComponent, etc.) after the initial detectChanges() call - a second pass
    // is needed to render those updates into the DOM.
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance as any, dialogRef: dRef };
  }

  it("renders AutoConfirmPolicyEditComponent without an On/Off badge, and with a Cancel button", async () => {
    const { fixture, component } = await setupModal();

    expect(component.policyComponent()).toBeInstanceOf(AutoConfirmPolicyEditComponent);
    expect(fixture.nativeElement.querySelector("[bitBadge]")).toBeNull();
    expect(fixture.nativeElement.textContent).toContain("cancel");
  });

  it("renders the first-time 'available now' badge in the modal title when opened from the vault prompt", async () => {
    // Mirrors how WebVaultPromptService opens this exact combination: the (formerly v1-only)
    // AutoConfirmPolicyEditComponent title template, rendered inside the modal (not a drawer).
    const { fixture } = await setupModal(true);

    expect(fixture.nativeElement.textContent).toContain("availableNow");
  });

  it("does not render the 'available now' badge when not opened as a first-time dialog", async () => {
    const { fixture } = await setupModal(false);

    expect(fixture.nativeElement.textContent).not.toContain("availableNow");
  });

  it("closes the dialog via the discard-guard's closePredicate when Cancel is clicked", async () => {
    const { component, dialogRef } = await setupModal();

    component.cancel();

    expect(dialogRef.close).toHaveBeenCalled();
  });

  describe("open()", () => {
    it("delegates to dialogService.open() with this component", () => {
      const dialogService = mock<DialogService>();
      const config = { data: {} as PolicyEditDialogData };

      MultiStepPolicyEditModalComponent.open(dialogService, config);

      expect(dialogService.open).toHaveBeenCalledWith(MultiStepPolicyEditModalComponent, config);
    });
  });
});
