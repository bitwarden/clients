import { animate, state, style, transition, trigger } from "@angular/animations";
import { ConnectedPosition } from "@angular/cdk/overlay";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { concatMap, Subject, takeUntil } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { Account } from "@bitwarden/common/platform/models/domain/account";

type ActiveAccount = {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
};

export class SwitcherAccount extends Account {
  get serverUrl() {
    return this.removeWebProtocolFromString(
      this.settings?.environmentUrls?.base ??
        this.settings?.environmentUrls.api ??
        "https://bitwarden.com"
    );
  }

  avatarColor: string;

  private removeWebProtocolFromString(urlString: string) {
    const regex = /http(s)?(:)?(\/\/)?|(\/\/)?(www\.)?/g;
    return urlString.replace(regex, "");
  }
}

@Component({
  selector: "app-account-switcher",
  templateUrl: "account-switcher.component.html",
  animations: [
    trigger("transformPanel", [
      state(
        "void",
        style({
          opacity: 0,
        })
      ),
      transition(
        "void => open",
        animate(
          "100ms linear",
          style({
            opacity: 1,
          })
        )
      ),
      transition("* => void", animate("100ms linear", style({ opacity: 0 }))),
    ]),
  ],
})
export class AccountSwitcherComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  isOpen = false;
  accounts: { [userId: string]: SwitcherAccount } = {};
  activeAccount?: ActiveAccount;
  serverUrl: string;
  authStatus = AuthenticationStatus;
  overlayPosition: ConnectedPosition[] = [
    {
      originX: "end",
      originY: "bottom",
      overlayX: "end",
      overlayY: "top",
    },
  ];

  get showSwitcher() {
    const userIsInAVault = !Utils.isNullOrWhitespace(this.activeAccount?.email);
    const userIsAddingAnAdditionalAccount = Object.keys(this.accounts).length > 0;
    return userIsInAVault || userIsAddingAnAdditionalAccount;
  }

  get numberOfAccounts() {
    if (this.accounts == null) {
      this.isOpen = false;
      return 0;
    }
    return Object.keys(this.accounts).length;
  }

  constructor(
    private stateService: StateService,
    private authService: AuthService,
    private messagingService: MessagingService,
    private router: Router,
    private tokenService: TokenService
  ) {}

  async ngOnInit(): Promise<void> {
    this.stateService.accounts$
      .pipe(
        concatMap(async (accounts: { [userId: string]: Account }) => {
          for (const userId in accounts) {
            accounts[userId].profile.authenticationStatus = await this.authService.getAuthStatus(
              userId
            );
          }

          this.accounts = await this.createSwitcherAccounts(accounts);
          try {
            this.activeAccount = {
              id: await this.tokenService.getUserId(),
              name: (await this.tokenService.getName()) ?? (await this.tokenService.getEmail()),
              email: await this.tokenService.getEmail(),
              avatarColor: await this.stateService.getAvatarColor(),
            };
          } catch {
            this.activeAccount = undefined;
          }
        }),
        takeUntil(this.destroy$)
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
    await this.stateService.setActiveUser(null);
    await this.stateService.setRememberedEmail(null);
    this.router.navigate(["/login"]);
  }

  private async createSwitcherAccounts(baseAccounts: {
    [userId: string]: Account;
  }): Promise<{ [userId: string]: SwitcherAccount }> {
    const switcherAccounts: { [userId: string]: SwitcherAccount } = {};
    for (const userId in baseAccounts) {
      if (userId == null || userId === (await this.stateService.getUserId())) {
        continue;
      }

      // environmentUrls are stored on disk and must be retrieved separately from the in memory state offered from subscribing to accounts
      baseAccounts[userId].settings.environmentUrls = await this.stateService.getEnvironmentUrls({
        userId: userId,
      });
      switcherAccounts[userId] = new SwitcherAccount(baseAccounts[userId]);
      switcherAccounts[userId].avatarColor = await this.stateService.getAvatarColor({
        userId: userId,
      });
    }
    return switcherAccounts;
  }
}
