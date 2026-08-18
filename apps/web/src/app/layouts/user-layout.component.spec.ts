import { signal } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { SideNavService } from "@bitwarden/components";
import { SendPolicyService } from "@bitwarden/send-ui";
import { VaultFilterMemoryService } from "@bitwarden/vault";
import { PremiumSubscriptionRoutingService } from "@bitwarden/web-vault/app/billing/individual/services/premium-subscription-routing.service";

import { CoachmarkService } from "../vault/components/coachmark";

import { UserLayoutComponent } from "./user-layout.component";

describe("UserLayoutComponent", () => {
  let fixture: ComponentFixture<UserLayoutComponent>;
  let router: Router;
  let filterMemory: { paramsFor: jest.Mock };

  beforeEach(async () => {
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "user-1" as UserId } as Account);

    const policyService = mock<PolicyService>();
    policyService.policyAppliesToUser$.mockReturnValue(of(false));

    const sendPolicyService = mock<SendPolicyService>();
    sendPolicyService.disableSend$ = of(false);

    const premiumSubscriptionRoutingService = mock<PremiumSubscriptionRoutingService>();
    premiumSubscriptionRoutingService.getSubscriptionRoute$.mockReturnValue(of(null));

    filterMemory = { paramsFor: jest.fn().mockReturnValue({}) };

    await TestBed.configureTestingModule({
      imports: [UserLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AccountService, useValue: accountService },
        { provide: PolicyService, useValue: policyService },
        { provide: SendPolicyService, useValue: sendPolicyService },
        { provide: SyncService, useValue: mock<SyncService>() },
        {
          provide: PremiumSubscriptionRoutingService,
          useValue: premiumSubscriptionRoutingService,
        },
        { provide: VaultFilterMemoryService, useValue: filterMemory },
        // Pulls in the organization and nudge services to decide which step is active; the
        // component only reads the resulting id.
        { provide: CoachmarkService, useValue: { activeStepId: signal(undefined) } },
        { provide: SideNavService, useValue: { open: signal(true) } },
      ],
    })
      .overrideComponent(UserLayoutComponent, {
        // The nav tree pulls in its own dependency trees (the org switcher, coachmarks, the
        // billing nav item). None of it bears on the vault link's target, so the template is
        // replaced rather than stubbed piece by piece.
        set: { imports: [], template: "" },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(UserLayoutComponent);
  });

  /** The component's `vaultRoute`, serialized the way `routerLink` would navigate it. */
  function vaultLink(): string {
    const route = (fixture.componentInstance as any).vaultRoute();
    return router.serializeUrl(route);
  }

  it("links to the vault with no params when nothing has been remembered", fakeAsync(() => {
    tick();

    expect(vaultLink()).toBe("/vault");
  }));

  it("carries the remembered filters into the vault link", fakeAsync(() => {
    filterMemory.paramsFor.mockReturnValue({ "vault.type": "1", "vault.folder": "f-1" });
    tick();

    expect(vaultLink()).toBe("/vault?vault.type=1&vault.folder=f-1");
  }));

  it("reads the memory under the all-items scope", fakeAsync(() => {
    tick();
    vaultLink();

    expect(filterMemory.paramsFor).toHaveBeenCalledWith("all");
  }));
});
