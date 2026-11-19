import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  OnInit,
  afterNextRender,
  inject,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { combineLatest, filter, firstValueFrom, map, take } from "rxjs";

import { callerOrganizations$, unlicensedForPam } from "@bitwarden/bit-pam";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PopoverModule, TabsModule, ToastService } from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";
import { I18nPipe } from "@bitwarden/ui-common";
import { CoachmarkComponent, CoachmarkService, pamAccessRequestsTour } from "@bitwarden/vault";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { ApprovalPrivilegeService } from "../approvals/approval-privilege.service";
import { ApproverInboxService } from "../approvals/approver-inbox.service";

import { MyAccessService } from "./my-access.service";

/**
 * The "Access requests" shell at `/pam`, over the Approvals, My requests and History tab routes.
 * Approvals is hidden for a non-approver rather than shown empty.
 */
@Component({
  selector: "pam-access-requests",
  templateUrl: "./access-requests.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, HeaderModule, TabsModule, PopoverModule, I18nPipe, CoachmarkComponent],
})
export class AccessRequestsComponent implements OnInit {
  private readonly myAccess = inject(MyAccessService);
  private readonly inbox = inject(ApproverInboxService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly configService = inject(ConfigService);
  private readonly stateProvider = inject(StateProvider);
  private readonly injector = inject(Injector);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);

  protected readonly coachmark = inject(CoachmarkService);

  /** The My requests berry, counting everything the caller holds or can still act on. */
  protected readonly myRequestsCount = toSignal(
    combineLatest([
      this.myAccess.pendingRows$,
      this.myAccess.extensionRows$,
      this.myAccess.leases$,
    ]).pipe(
      map(([pending, extensions, leases]) => pending.length + extensions.length + leases.length),
    ),
    { initialValue: 0 },
  );

  private readonly approvalPrivileges$ = inject(ApprovalPrivilegeService).canApprove$;

  protected readonly canApprove = toSignal(this.approvalPrivileges$, { initialValue: false });

  protected readonly approvalsCount = toSignal(this.inbox.pendingCount$, { initialValue: 0 });

  ngOnInit(): void {
    void this.myAccess.load();
    void this.startTour();

    // Driven off the stream, since `canApprove()` still holds its initial `false` until the
    // organization lookup resolves.
    this.approvalPrivileges$
      .pipe(filter(Boolean), take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.inbox.load());

    this.inbox.loadError$
      .pipe(
        filter((e) => e != null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        this.logService.error(e);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("pamInboxLoadFailed"),
        });
      });

    this.myAccess.loadError$
      .pipe(
        filter((e) => e != null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        this.logService.error(e);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("pamMyRequestsLoadError"),
        });
      });
  }

  /**
   * Starts the first-visit tour. `canApprove()` still holds its initial `false` until the
   * organization lookup resolves, so the stream is awaited to keep the Approvals step out of the
   * tour for non-approvers (and in for approvers, whose tab anchor is rendered by then).
   */
  private async startTour(): Promise<void> {
    if (!(await this.configService.getFeatureFlag(FeatureFlag.Pam))) {
      return;
    }
    if (await this.unlicensedEverywhere()) {
      return;
    }
    const canApprove = await firstValueFrom(this.approvalPrivileges$);
    // `canApprove()` renders the Approvals tab on the next change detection pass; wait for it so
    // every step's anchor is mounted before the tour can land on it.
    await new Promise<void>((resolve) =>
      afterNextRender(() => resolve(), { injector: this.injector }),
    );
    await this.coachmark.startTour(pamAccessRequestsTour(this.stateProvider, canApprove));
  }

  /**
   * Whether the caller belongs to PAM organizations and is unlicensed in every one of them, so the
   * tour would walk them through access the server no longer serves. Waits for the first
   * membership emission (unknown is not "licensed"), and leaves the My requests tab itself alone,
   * since withdrawing a request stays reachable there.
   */
  private async unlicensedEverywhere(): Promise<boolean> {
    const organizations = await firstValueFrom(
      callerOrganizations$(this.accountService, this.organizationService),
    );
    const pamOrganizations = organizations.filter((o) => o.usePam);
    return pamOrganizations.length > 0 && pamOrganizations.every((o) => unlicensedForPam(o));
  }
}
