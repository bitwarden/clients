import { animate, state, style, transition, trigger } from "@angular/animations";
import { ConnectedPosition } from "@angular/cdk/overlay";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { concatMap, firstValueFrom, Subject, takeUntil } from "rxjs";

import { LoginEmailServiceAbstraction } from "@bitwarden/auth/common";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { Account } from "@bitwarden/common/platform/models/domain/account";
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
export class AccountSwitcherComponent implements OnInit, OnDestroy {
  activeAccount?: ActiveAccount;
  inactiveAccounts: { [userId: string]: InactiveAccount } = {};

  authStatus = AuthenticationStatus;

  isOpen = false;
  overlayPosition: ConnectedPosition[] = [
    {
      originX: "end",
      originY: "bottom",
      overlayX: "end",
      overlayY: "top",
    },
  ];

  private destroy$ = new Subject<void>();

  get showSwitcher() {
    const userIsInAVault = !Utils.isNullOrWhitespace(this.activeAccount?.email);
    const userIsAddingAnAdditionalAccount = Object.keys(this.inactiveAccounts).length > 0;
    return userIsInAVault || userIsAddingAnAdditionalAccount;
  }

  get numberOfAccounts() {
    if (this.inactiveAccounts == null) {
      this.isOpen = false;
      return 0;
    }
    return Object.keys(this.inactiveAccounts).length;
  }

  constructor(
    private stateService: StateService,
    private authService: AuthService,
    private avatarService: AvatarService,
    private messagingService: MessagingService,
    private router: Router,
    private tokenService: TokenService,
    private environmentService: EnvironmentService,
    private loginEmailService: LoginEmailServiceAbstraction,
  ) {}

  async ngOnInit(): Promise<void> {
    this.stateService.accounts$
      .pipe(
        concatMap(async (accounts: { [userId: string]: Account }) => {
          this.inactiveAccounts = await this.createInactiveAccounts(accounts);

          try {
            this.activeAccount = {
              id: await this.tokenService.getUserId(),
              name: (await this.tokenService.getName()) ?? (await this.tokenService.getEmail()),
              email: await this.tokenService.getEmail(),
              avatarColor: await firstValueFrom(this.avatarService.avatarColor$),
              server: (await this.environmentService.getEnvironment())?.getHostname(),
            };
          } catch {
            this.activeAccount = undefined;
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

    this.loginEmailService.setRememberEmail(false);
    await this.loginEmailService.saveEmailSettings();

    await this.router.navigate(["/login"]);
    await this.stateService.setActiveUser(null);
  }

  private async createInactiveAccounts(baseAccounts: {
    [userId: string]: Account;
  }): Promise<{ [userId: string]: InactiveAccount }> {
    const inactiveAccounts: { [userId: string]: InactiveAccount } = {};

    for (const userId in baseAccounts) {
      if (userId == null || userId === (await this.stateService.getUserId())) {
        continue;
      }

      inactiveAccounts[userId] = {
        id: userId,
        name: baseAccounts[userId].profile.name,
        email: baseAccounts[userId].profile.email,
        authenticationStatus: await this.authService.getAuthStatus(userId),
        avatarColor: await firstValueFrom(this.avatarService.getUserAvatarColor$(userId as UserId)),
        server: (await this.environmentService.getEnvironment(userId))?.getHostname(),
      };
    }

    return inactiveAccounts;
  }
}
