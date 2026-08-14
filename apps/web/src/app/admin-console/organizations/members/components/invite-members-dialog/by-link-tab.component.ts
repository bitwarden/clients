import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input, signal } from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import {
  combineLatest,
  filter,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  startWith,
  switchMap,
} from "rxjs";

import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  FormFieldModule,
  IconButtonModule,
  LinkComponent,
  ToastService,
  TooltipDirective,
} from "@bitwarden/components";
import {
  OrganizationInviteLink,
  OrganizationInviteLinkService,
} from "@bitwarden/organization-invite-link";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  standalone: true,
  selector: "app-by-link-tab",
  templateUrl: "by-link-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    CommonModule,
    FormFieldModule,
    I18nPipe,
    IconButtonModule,
    ReactiveFormsModule,
    LinkComponent,
    TooltipDirective,
  ],
})
export class ByLinkTabComponent {
  readonly organizationId = input.required<OrganizationId, string>({
    transform: (value: string) => value as OrganizationId,
  });

  private readonly accountService = inject(AccountService);
  private readonly inviteLinkService = inject(OrganizationInviteLinkService);
  private readonly orgDomainApiService = inject(OrgDomainApiServiceAbstraction);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly fb = inject(FormBuilder);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly eventCollectionService = inject(EventCollectionService);

  private readonly userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(getUserId);

  protected readonly inviteLink$: Observable<OrganizationInviteLink | undefined> = combineLatest([
    this.userId$,
    toObservable(this.organizationId),
  ]).pipe(
    switchMap(([userId, orgId]) => this.inviteLinkService.inviteLink$(userId, orgId)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected readonly inviteLinkUrl$: Observable<string> = combineLatest([
    this.userId$,
    toObservable(this.organizationId),
    this.inviteLink$.pipe(filter((link) => link != null)),
  ]).pipe(
    switchMap(([userId, orgId, inviteLink]) =>
      this.inviteLinkService.reconstructUrl(userId, orgId, inviteLink),
    ),
  );

  readonly hasInviteLinkUrl$: Observable<boolean> = this.inviteLink$.pipe(
    map((inviteLink) => inviteLink != null),
  );

  readonly form = this.fb.group({
    domains: ["", Validators.required],
  });

  readonly domainsEmpty = toSignal(
    this.form.controls.domains.valueChanges.pipe(
      map((v) => !v || v.trim().length === 0),
      startWith(true),
    ),
    { initialValue: true },
  );

  private readonly prefillAttempted = signal(false);

  constructor() {
    this.inviteLink$.pipe(takeUntilDestroyed()).subscribe((inviteLink) => {
      if (inviteLink && !this.form.dirty) {
        this.prefillAttempted.set(true);
        this.form.controls.domains.setValue(inviteLink.allowedDomains.join(", "));
      } else if (inviteLink == null && !this.form.dirty && !this.prefillAttempted()) {
        this.prefillAttempted.set(true);
        void this.prefillFromVerifiedDomains();
      }
    });
  }

  private async prefillFromVerifiedDomains(): Promise<void> {
    const allDomains = await this.orgDomainApiService.getAllByOrgId(this.organizationId());
    const verifiedDomainNames = allDomains
      .filter((d) => d.verifiedDate != null)
      .map((d) => d.domainName);

    if (verifiedDomainNames.length > 0) {
      this.form.controls.domains.setValue(verifiedDomainNames.join(", "));
      this.form.controls.domains.markAsDirty();
    }
  }

  readonly save = async () => {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const userId = await firstValueFrom(this.userId$);
    const rawDomains = this.form.value.domains;
    if (rawDomains == null) {
      throw new Error("Must provide at least one valid domain.");
    }

    const domains = rawDomains
      .split(",")
      .map((domain) => domain.trim())
      .filter((domain) => domain.length > 0);

    const inviteLink = await firstValueFrom(this.inviteLink$);

    if (inviteLink) {
      await this.inviteLinkService.updateAllowedDomains(userId, this.organizationId(), domains);
    } else {
      // TODO: Determine supportsConfirmation from the state of the "require admin confirmation"
      // toggle switch in milestone 3
      await this.inviteLinkService.createInviteLink(userId, this.organizationId(), domains, false);
    }

    this.form.markAsPristine();

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("domainsEdited"),
    });
  };

  readonly copyLink = async () => {
    const url = await firstValueFrom(this.inviteLinkUrl$);
    if (url == null) {
      return;
    }

    this.platformUtilsService.copyToClipboard(url);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("inviteLinkCopied"),
    });

    await this.eventCollectionService.collect(
      EventType.Organization_InviteLinkClientCopied,
      undefined,
      false,
      this.organizationId(),
    );
  };

  readonly refreshLink = async () => {
    const userId = await firstValueFrom(this.userId$);
    // TODO: Milestone 3: determine supportsConfirmation from the state of the
    // "require admin confirmation" toggle switch TBD
    await this.inviteLinkService.refreshInviteLink(userId, this.organizationId(), false);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("inviteLinkRegenerated"),
    });
  };

  readonly deactivateLink = async () => {
    const userId = await firstValueFrom(this.userId$);
    await this.inviteLinkService.delete(userId, this.organizationId());
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("inviteLinkInvalidated"),
    });
  };
}
