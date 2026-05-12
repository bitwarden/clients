import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import {
  combineLatest,
  filter,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  switchMap,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
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
  ],
})
export class ByLinkTabComponent {
  readonly organizationId = input.required<OrganizationId, string>({
    transform: (value: string) => value as OrganizationId,
  });

  private readonly accountService = inject(AccountService);
  private readonly inviteLinkService = inject(OrganizationInviteLinkService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly fb = inject(FormBuilder);
  private readonly platformUtilsService = inject(PlatformUtilsService);

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

  readonly hasInviteLinkUrl$: Observable<boolean> = this.inviteLinkUrl$.pipe(
    map((inviteLink) => inviteLink != undefined),
  );

  readonly form = this.fb.group({
    domains: ["", Validators.required],
  });

  constructor() {
    this.inviteLink$.pipe(takeUntilDestroyed()).subscribe((inviteLink) => {
      if (inviteLink && !this.form.dirty) {
        this.form.controls.domains.setValue(inviteLink.allowedDomains.join(", "));
      }
    });
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

    if (domains.length === 0) {
      this.form.controls.domains.setErrors({ required: true });
      return;
    }

    const inviteLink = await firstValueFrom(this.inviteLink$);
    if (inviteLink) {
      await this.inviteLinkService.updateInviteLink(userId, this.organizationId(), domains);
    } else {
      await this.inviteLinkService.createInviteLink(userId, this.organizationId(), domains);
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
  };

  readonly refreshLink = async () => {
    const userId = await firstValueFrom(this.userId$);
    await this.inviteLinkService.refreshInviteLink(userId, this.organizationId());

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("inviteLinkRegenerated"),
    });
  };
}
