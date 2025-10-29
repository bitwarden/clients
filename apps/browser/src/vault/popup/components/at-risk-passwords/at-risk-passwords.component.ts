import { CommonModule } from "@angular/common";
import { Component, DestroyRef, inject, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import {
  combineLatest,
  concat,
  concatMap,
  firstValueFrom,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  take,
} from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AutofillOverlayVisibility } from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { EndUserNotificationService } from "@bitwarden/common/vault/notifications";
import { SecurityTaskType, TaskService } from "@bitwarden/common/vault/tasks";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import {
  BadgeModule,
  ButtonModule,
  CalloutModule,
  DialogModule,
  DialogService,
  ItemModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import {
  AtRiskPasswordCalloutService,
  ChangeLoginPasswordService,
  DefaultChangeLoginPasswordService,
  PasswordRepromptService,
  VaultCarouselModule,
} from "@bitwarden/vault";

import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";
import {
  AtRiskCarouselDialogComponent,
  AtRiskCarouselDialogResult,
} from "../at-risk-carousel-dialog/at-risk-carousel-dialog.component";

import { AtRiskPasswordPageService } from "./at-risk-password-page.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    ItemModule,
    CommonModule,
    JslibModule,
    TypographyModule,
    CalloutModule,
    ButtonModule,
    BadgeModule,
    DialogModule,
    VaultCarouselModule,
  ],
  providers: [
    AtRiskPasswordPageService,
    { provide: ChangeLoginPasswordService, useClass: DefaultChangeLoginPasswordService },
    AtRiskPasswordCalloutService,
  ],
  selector: "vault-at-risk-passwords",
  templateUrl: "./at-risk-passwords.component.html",
})
export class AtRiskPasswordsComponent implements OnInit {
  private taskService = inject(TaskService);
  private organizationService = inject(OrganizationService);
  private cipherService = inject(CipherService);
  private i18nService = inject(I18nService);
  private accountService = inject(AccountService);
  private passwordRepromptService = inject(PasswordRepromptService);
  private router = inject(Router);
  private autofillSettingsService = inject(AutofillSettingsServiceAbstraction);
  private toastService = inject(ToastService);
  private atRiskPasswordPageService = inject(AtRiskPasswordPageService);
  private changeLoginPasswordService = inject(ChangeLoginPasswordService);
  private platformUtilsService = inject(PlatformUtilsService);
  private dialogService = inject(DialogService);
  private endUserNotificationService = inject(EndUserNotificationService);
  private destroyRef = inject(DestroyRef);
  private atRiskPasswordCalloutService = inject(AtRiskPasswordCalloutService);

  /**
   * The cipher that is currently being launched. Used to show a loading spinner on the badge button.
   * The UI utilize a bitBadge which does not support async actions (like bitButton does).
   * @protected
   */
  protected readonly launchingCipher = signal<CipherView | null>(null);

  private activeUserData$ = this.accountService.activeAccount$.pipe(
    filterOutNullish(),
    switchMap((user) =>
      combineLatest([
        this.taskService.pendingTasks$(user.id),
        this.cipherService.cipherViews$(user.id).pipe(
          filterOutNullish(),
          map((ciphers) => Object.fromEntries(ciphers.map((c) => [c.id, c]))),
        ),
        of(user),
      ]),
    ),
    map(([tasks, ciphers, user]) => ({
      tasks,
      ciphers,
      userId: user.id,
    })),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected loading$ = this.activeUserData$.pipe(
    map(() => false),
    startWith(true),
  );

  private calloutDismissed$ = this.activeUserData$.pipe(
    switchMap(({ userId }) => this.atRiskPasswordPageService.isCalloutDismissed(userId)),
  );
  private inlineAutofillSettingEnabled$ = this.autofillSettingsService.inlineMenuVisibility$.pipe(
    map((setting) => setting !== AutofillOverlayVisibility.Off),
  );

  protected showAutofillCallout$ = combineLatest([
    this.calloutDismissed$,
    this.inlineAutofillSettingEnabled$,
  ]).pipe(
    map(([calloutDismissed, inlineAutofillSettingEnabled]) => {
      return !calloutDismissed && !inlineAutofillSettingEnabled;
    }),
    startWith(false),
  );

  protected atRiskItems$ = this.activeUserData$.pipe(
    map(({ tasks, ciphers }) =>
      tasks
        .filter(
          (t) =>
            t.type === SecurityTaskType.UpdateAtRiskCredential &&
            t.cipherId != null &&
            ciphers[t.cipherId] != null &&
            ciphers[t.cipherId].edit &&
            ciphers[t.cipherId].viewPassword &&
            !ciphers[t.cipherId].isDeleted,
        )
        .map((t) => ciphers[t.cipherId!]),
    ),
  );

  protected pageDescription$ = combineLatest([this.activeUserData$, this.atRiskItems$]).pipe(
    switchMap(([{ userId }, atRiskCiphers]) => {
      const orgIds = new Set(
        atRiskCiphers.filter((c) => c.organizationId).map((c) => c.organizationId),
      ) as Set<string>;
      if (orgIds.size === 1) {
        const [orgId] = orgIds;
        return this.organizationService.organizations$(userId).pipe(
          getOrganizationById(orgId),
          map((org) =>
            this.i18nService.t(
              atRiskCiphers.length === 1
                ? "atRiskPasswordDescSingleOrg"
                : "atRiskPasswordsDescSingleOrgPlural",
              org?.name,
              atRiskCiphers.length,
            ),
          ),
        );
      }

      return of(this.i18nService.t("atRiskPasswordsDescMultiOrgPlural", atRiskCiphers.length));
    }),
  );

  async ngOnInit() {
    const { userId } = await firstValueFrom(this.activeUserData$);
    const gettingStartedDismissed = await firstValueFrom(
      this.atRiskPasswordPageService.isGettingStartedDismissed(userId),
    );
    if (!gettingStartedDismissed) {
      const ref = AtRiskCarouselDialogComponent.open(this.dialogService);

      const result = await firstValueFrom(ref.closed);
      if (result === AtRiskCarouselDialogResult.Dismissed) {
        await this.atRiskPasswordPageService.dismissGettingStarted(userId);
      }
    }

    this.markTaskNotificationsAsRead();

    this.atRiskPasswordCalloutService.updateAtRiskPasswordState(userId, {
      hasInteractedWithTasks: true,
      tasksBannerDismissed: false,
    });
  }

  private markTaskNotificationsAsRead() {
    this.activeUserData$
      .pipe(
        switchMap(({ tasks, userId }) => {
          return this.endUserNotificationService.unreadNotifications$(userId).pipe(
            take(1),
            map((notifications) => {
              return notifications.filter((notification) => {
                return tasks.some((task) => task.id === notification.taskId);
              });
            }),
            concatMap((unreadTaskNotifications) => {
              // TODO: Investigate creating a bulk endpoint to mark notifications as read
              return concat(
                ...unreadTaskNotifications.map((n) =>
                  this.endUserNotificationService.markAsRead(n.id, userId),
                ),
              );
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  async viewCipher(cipher: CipherView) {
    const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(cipher);
    if (!repromptPassed) {
      return;
    }
    await this.router.navigate(["/view-cipher"], {
      queryParams: { cipherId: cipher.id, type: cipher.type },
    });
  }

  async activateInlineAutofillMenuVisibility() {
    await this.autofillSettingsService.setInlineMenuVisibility(
      AutofillOverlayVisibility.OnButtonClick,
    );
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("turnedOnAutofill"),
      title: "",
    });
  }

  async dismissCallout() {
    const { userId } = await firstValueFrom(this.activeUserData$);
    await this.atRiskPasswordPageService.dismissCallout(userId);
  }

  protected hasLoginUri(cipher: CipherView) {
    return cipher.login?.hasUris;
  }

  launchChangePassword = async (cipher: CipherView) => {
    try {
      this.launchingCipher.set(cipher);
      const url = await this.changeLoginPasswordService.getChangePasswordUrl(cipher);

      if (url == null) {
        return;
      }

      this.platformUtilsService.launchUri(url);
    } finally {
      this.launchingCipher.set(null);
    }
  };

  /**
   * This page can be the first page the user sees when the extension launches,
   * which can conflict with the `PopupRouterCacheService`. This replaces the
   * built-in back button behavior so the user always navigates to the vault.
   */
  protected navigateToVault = async () => {
    await this.router.navigate(["/tabs/vault"]);
  };
}
