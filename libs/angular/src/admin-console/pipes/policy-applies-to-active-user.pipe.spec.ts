import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { PolicyAppliesToActiveUserPipe } from "./policy-applies-to-active-user.pipe";

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PolicyAppliesToActiveUserPipe, AsyncPipe],
  template: `
    @if ("DisableSend" | policyAppliesToActiveUser$ | async) {
      <span data-testid="active"></span>
    } @else {
      <span data-testid="inactive"></span>
    }
  `,
})
class TestComponent {}

describe("PolicyAppliesToActiveUserPipe", () => {
  let fixture: ComponentFixture<TestComponent>;
  let policyService: MockProxy<PolicyService>;
  let accountService: MockProxy<AccountService>;

  const fakeAccount: Account = {
    id: "user-id" as UserId,
    ...mockAccountInfoWith({ email: "test@test.com" }),
  };

  beforeEach(async () => {
    policyService = mock<PolicyService>();
    accountService = mock<AccountService>();
    accountService.activeAccount$ = new BehaviorSubject<Account | null>(fakeAccount);

    await TestBed.configureTestingModule({
      imports: [TestComponent],
      providers: [
        { provide: PolicyService, useValue: policyService },
        { provide: AccountService, useValue: accountService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestComponent);
  });

  it("returns true when the policy applies to the active user", async () => {
    policyService.policyAppliesToUser$.mockReturnValue(of(true));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.debugElement.query(By.css('[data-testid="active"]'))).not.toBeNull();
  });

  it("returns false when the policy does not apply to the active user", async () => {
    policyService.policyAppliesToUser$.mockReturnValue(of(false));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.debugElement.query(By.css('[data-testid="active"]'))).toBeNull();
  });

  it("updates when the policy emission changes", async () => {
    const policy$ = new BehaviorSubject(false);
    policyService.policyAppliesToUser$.mockReturnValue(policy$);

    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.debugElement.query(By.css('[data-testid="active"]'))).toBeNull();

    policy$.next(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.debugElement.query(By.css('[data-testid="active"]'))).not.toBeNull();
  });
});
