// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, map, Observable, Subject, switchMap } from "rxjs";

import { User } from "@bitwarden/angular/pipes/user-name.pipe";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { VaultTimeoutAction } from "@bitwarden/common/enums/vault-timeout-action.enum";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";

@Component({
  selector: "app-header",
  templateUrl: "./web-header.component.html",
})
export class WebHeaderComponent implements OnInit, OnDestroy {
  /**
   * Custom title that overrides the route data `titleId`
   */
  @Input() title: string;

  /**
   * Icon to show before the title
   */
  @Input() icon: string;
  private destroy$ = new Subject<void>();

  protected routeData$: Observable<{ titleId: string }>;
  protected account$: Observable<User & { id: UserId }>;
  protected canLock$: Observable<boolean>;
  protected selfHosted: boolean;
  protected hostname = location.hostname;
  protected organization$: Observable<Organization>;

  constructor(
    private route: ActivatedRoute,
    private platformUtilsService: PlatformUtilsService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private messagingService: MessagingService,
    private accountService: AccountService,
    private organizationService: OrganizationService,
  ) {
    this.routeData$ = this.route.data.pipe(
      map((params) => {
        return {
          titleId: params.titleId,
        };
      }),
    );

    this.selfHosted = this.platformUtilsService.isSelfHost();

    this.account$ = this.accountService.activeAccount$;
    this.canLock$ = this.vaultTimeoutSettingsService
      .availableVaultTimeoutActions$()
      .pipe(map((actions) => actions.includes(VaultTimeoutAction.Lock)));
  }

  async ngOnInit() {
    this.organization$ = combineLatest([
      this.route.params,
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.organizationService.organizations$(userId)),
      ),
    ]).pipe(map(([params, orgs]) => orgs.find((org) => org.id === params.organizationId)));
  }

  protected lock() {
    this.messagingService.send("lockVault");
  }

  protected logout() {
    this.messagingService.send("logout");
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
