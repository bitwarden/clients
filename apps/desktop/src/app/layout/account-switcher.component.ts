import { animate, state, style, transition, trigger } from "@angular/animations";
import { ConnectedPosition } from "@angular/cdk/overlay";
import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { combineLatest, firstValueFrom, map, Observable, switchMap } from "rxjs";

import { LoginEmailServiceAbstraction } from "@bitwarden/auth/common";
import { AccountInfo, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { UserId } from "@bitwarden/common/types/guid";

type ActiveAccount = {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  server: string;
};

type InactiveAccount = ActiveAccount & {
  authenticationStatus: AuthenticationStatus;
};

@Component({
  selector: "app-account-switcher",
  templateUrl: "account-switcher.component.html",
  animations: [
    trigger("transformPanel", [
      state(
        "void",
        style({
          opacity: 0,
        }),
      ),
      transition(
        "void => open",
        animate(
          "100ms linear",
          style({
            opacity: 1,
          }),
        ),
      ),
      transition("* => void", animate("100ms linear", style({ opacity: 0 }))),
    ]),
  ],
})
export class AccountSwitcherComponent {
  activeAccount$: Observable<ActiveAccount | null>;
  inactiveAccounts$: Observable<{ [userId: string]: InactiveAccount }>;
  authStatus = AuthenticationStatus;

  view$: Observable<{
    activeAccount: ActiveAccount | null;
    inactiveAccounts: { [userId: string]: InactiveAccount };
    numberOfAccounts: number;
    showSwitcher: boolean;
  }>;

  isOpen = false;
  overlayPosition: ConnectedPosition[] = [
    {
      originX: "end",
      originY: "bottom",
      overlayX: "end",
      overlayY: "top",
    },
  ];

  showSwitcher$: Observable<boolean>;

  numberOfAccounts$: Observable<number>;

  constructor(
    private stateService: StateService,
    private authService: AuthService,
    private avatarService: AvatarService,
    private messagingService: MessagingService,
    private router: Router,
    private environmentService: EnvironmentService,
    private loginEmailService: LoginEmailServiceAbstraction,
    private accountService: AccountService,
  ) {
    this.activeAccount$ = this.accountService.activeAccount$.pipe(
      switchMap(async (active) => {
        if (active == null) {
          return null;
        }

        if (!active.name && !active.email) {
          // We need to have this information at minimum to display them.
          return null;
        }

        return {
          id: active.id,
          name: active.name,
          email: active.email,
          avatarColor: await firstValueFrom(this.avatarService.avatarColor$),
          server: (await this.environmentService.getEnvironment())?.getHostname(),
        };
      }),
    );
    this.inactiveAccounts$ = combineLatest([
      this.activeAccount$,
      this.accountService.accounts$,
      this.authService.authStatuses$,
    ]).pipe(
      switchMap(async ([activeAccount, accounts, accountStatuses]) => {
        // Filter out logged out accounts and active account
        accounts = Object.fromEntries(
          Object.entries(accounts).filter(
            ([id]: [UserId, AccountInfo]) =>
              accountStatuses[id] !== AuthenticationStatus.LoggedOut || id === activeAccount?.id,
          ),
        );
        return this.createInactiveAccounts(accounts);
      }),
    );
    this.showSwitcher$ = combineLatest([this.activeAccount$, this.inactiveAccounts$]).pipe(
      map(([activeAccount, inactiveAccounts]) => {
        const hasActiveUser = activeAccount != null;
        const userIsAddingAnAdditionalAccount = Object.keys(inactiveAccounts).length > 0;
        return hasActiveUser || userIsAddingAnAdditionalAccount;
      }),
    );
    this.numberOfAccounts$ = this.inactiveAccounts$.pipe(
      map((accounts) => Object.keys(accounts).length),
    );

    this.view$ = combineLatest([
      this.activeAccount$,
      this.inactiveAccounts$,
      this.numberOfAccounts$,
      this.showSwitcher$,
    ]).pipe(
      map(([activeAccount, inactiveAccounts, numberOfAccounts, showSwitcher]) => ({
        activeAccount,
        inactiveAccounts,
        numberOfAccounts,
        showSwitcher,
      })),
    );
  }

  toggle() {
    this.isOpen = !this.isOpen;
  }

  close() {
    this.isOpen = false;
  }

  async switch(userId: string) {
    this.close();

    this.messagingService.send("switchAccount", { userId: userId });
  }

  async addAccount() {
    this.close();

    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    await this.stateService.clearDecryptedData(activeAccount?.id as UserId);
    await this.accountService.switchAccount(null);
    await this.router.navigate(["/login"]);
  }

  private async createInactiveAccounts(baseAccounts: {
    [userId: string]: AccountInfo;
  }): Promise<{ [userId: string]: InactiveAccount }> {
    const inactiveAccounts: { [userId: string]: InactiveAccount } = {};

    for (const userId in baseAccounts) {
      if (userId == null || userId === (await this.stateService.getUserId())) {
        continue;
      }

      inactiveAccounts[userId] = {
        id: userId,
        name: baseAccounts[userId].name,
        email: baseAccounts[userId].email,
        authenticationStatus: await this.authService.getAuthStatus(userId),
        avatarColor: await firstValueFrom(this.avatarService.getUserAvatarColor$(userId as UserId)),
        server: (await this.environmentService.getEnvironment(userId))?.getHostname(),
      };
    }

    return inactiveAccounts;
  }
}
