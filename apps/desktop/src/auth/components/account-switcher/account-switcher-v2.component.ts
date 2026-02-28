// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { animate, state, style, transition, trigger } from "@angular/animations";
import { A11yModule } from "@angular/cdk/a11y";
import { OverlayModule, ConnectedPosition } from "@angular/cdk/overlay";
import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { combineLatest, firstValueFrom, map, Observable, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountInfo, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { AvatarModule, IconButtonModule } from "@bitwarden/components";

import { DesktopBiometricsService } from "../../../key-management/biometrics/desktop.biometrics.service";

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

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-account-switcher-v2",
  templateUrl: "account-switcher-v2.component.html",
  imports: [CommonModule, OverlayModule, A11yModule, JslibModule, AvatarModule, IconButtonModule],
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
export class AccountSwitcherV2Component implements OnInit {
  protected readonly useNewAccountSwitcher = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.DesktopUiMigrationMilestone4),
    { initialValue: false },
  );

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
  disabled = false;

  constructor(
    private authService: AuthService,
    private avatarService: AvatarService,
    private messagingService: MessagingService,
    private messageListener: MessageListener,
    private router: Router,
    private environmentService: EnvironmentService,
    private accountService: AccountService,
    private biometricsService: DesktopBiometricsService,
    private configService: ConfigService,
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
          server: (
            await firstValueFrom(this.environmentService.getEnvironment$(active.id))
          )?.getHostname(),
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

  async ngOnInit() {
    const active = await firstValueFrom(this.accountService.activeAccount$);
    if (active == null) {
      return;
    }
    const authStatus = await firstValueFrom(
      this.authService.authStatuses$.pipe(map((statuses) => statuses[active.id])),
    );
    if (authStatus === AuthenticationStatus.LoggedOut) {
      const nextUpAccount = await firstValueFrom(this.accountService.nextUpAccount$);
      if (nextUpAccount != null) {
        await this.switch(nextUpAccount.id);
      } else {
        await this.addAccount();
      }
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
  }

  close() {
    this.isOpen = false;
  }

  async switch(userId: string) {
    this.close();
    await this.biometricsService.setShouldAutopromptNow(true);

    this.disabled = true;
    const accountSwitchFinishedPromise = firstValueFrom(
      this.messageListener.messages$(new CommandDefinition("finishSwitchAccount")),
    );
    this.messagingService.send("switchAccount", { userId });
    await accountSwitchFinishedPromise;
    this.disabled = false;
  }

  async addAccount() {
    this.close();

    await this.accountService.switchAccount(null);
    await this.router.navigate(["/login"]);
  }

  private async createInactiveAccounts(baseAccounts: {
    [userId: string]: AccountInfo;
  }): Promise<{ [userId: string]: InactiveAccount }> {
    const inactiveAccounts: { [userId: string]: InactiveAccount } = {};

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
    for (const userId in baseAccounts) {
      if (userId == null || userId === activeUserId) {
        continue;
      }

      inactiveAccounts[userId] = {
        id: userId,
        name: baseAccounts[userId].name,
        email: baseAccounts[userId].email,
        authenticationStatus: await this.authService.getAuthStatus(userId),
        avatarColor: await firstValueFrom(this.avatarService.getUserAvatarColor$(userId as UserId)),
        server: (
          await firstValueFrom(this.environmentService.getEnvironment$(userId as UserId))
        )?.getHostname(),
      };
    }

    return inactiveAccounts;
  }
}
