import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { hasPasswordGuard } from "./has-password.guard";

@Component({ template: "", standalone: false, changeDetection: ChangeDetectionStrategy.OnPush })
export class EmptyComponent {}

describe("hasPasswordGuard", () => {
  const activeUser: Account = {
    id: "fake_user_id" as UserId,
    ...mockAccountInfoWith({
      email: "test@email.com",
      name: "Test User",
    }),
  };

  const setup = (activeUser: Account | null, userHasPassword: boolean | null = null) => {
    const accountService = mock<AccountService>();
    const userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();

    accountService.activeAccount$ = new BehaviorSubject<Account | null>(activeUser);
    if (userHasPassword !== null) {
      userDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(userHasPassword));
    }

    const testBed = TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: accountService },
        {
          provide: UserDecryptionOptionsServiceAbstraction,
          useValue: userDecryptionOptionsService,
        },
        provideRouter([
          { path: "", component: EmptyComponent },
          { path: "redirect-target", component: EmptyComponent },
          {
            path: "protected-route",
            component: EmptyComponent,
            canActivate: [hasPasswordGuard(["redirect-target"])],
          },
        ]),
      ],
    });

    return {
      router: testBed.inject(Router),
    };
  };

  it("allows access when user has a password", async () => {
    const { router } = setup(activeUser, true);

    const result = await router.navigate(["protected-route"]);

    expect(result).toBe(true);
    expect(router.url).toBe("/protected-route");
  });

  it("redirects to specified route when user does not have a password", async () => {
    const { router } = setup(activeUser, false);

    await router.navigate(["protected-route"]);

    expect(router.url).toBe("/redirect-target");
  });

  it("redirects to default route when user does not have a password and no redirect specified", async () => {
    const accountService = mock<AccountService>();
    const userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();

    accountService.activeAccount$ = new BehaviorSubject<Account | null>(activeUser);
    userDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(false));

    const testBed = TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: accountService },
        {
          provide: UserDecryptionOptionsServiceAbstraction,
          useValue: userDecryptionOptionsService,
        },
        provideRouter([
          { path: "", component: EmptyComponent },
          {
            path: "protected-route",
            component: EmptyComponent,
            canActivate: [hasPasswordGuard()],
          },
        ]),
      ],
    });

    const router = testBed.inject(Router);

    await router.navigate(["protected-route"]);

    expect(router.url).toBe("/");
  });
});
