import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  Signal,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { combineLatest, firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  FormFieldModule,
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
    ReactiveFormsModule,
    LinkComponent,
  ],
})
export class ByLinkTabComponent {
  readonly organizationId = input.required<OrganizationId, string>({
    transform: (value: string) => value as OrganizationId,
  });
  readonly isDirtyChange = output<boolean>();

  private readonly accountService = inject(AccountService);
  private readonly inviteLinkService = inject(OrganizationInviteLinkService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly fb = inject(FormBuilder);

  protected readonly isDirty = signal(false);
  protected readonly inviteLink: Signal<OrganizationInviteLink | undefined> = toSignal(
    combineLatest([
      this.accountService.activeAccount$.pipe(getUserId),
      toObservable(this.organizationId),
    ]).pipe(
      switchMap(([userId, organizationId]) =>
        this.inviteLinkService.inviteLink$(userId, organizationId),
      ),
    ),
  );

  protected readonly form = this.fb.group({
    domains: ["", Validators.required],
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const dirty = this.form.dirty;
      this.isDirty.set(dirty);
      this.isDirtyChange.emit(dirty);
    });

    effect(() => {
      const inviteLink = this.inviteLink();
      if (inviteLink && !this.form.dirty) {
        this.form.controls.domains.setValue(inviteLink.allowedDomains.join(", "));
        this.form.markAsPristine();
      }
    });
  }

  readonly save = async () => {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const rawDomains = this.form.value.domains;
    if (rawDomains == null) {
      throw new Error("Must provide at least one valid domain.");
    }

    const domains = rawDomains
      .split(",")
      .map((domain) => domain.trim())
      .filter((domain) => domain.length > 0);

    if (this.inviteLink()) {
      await this.inviteLinkService.updateInviteLink(userId, this.organizationId(), domains);
    } else {
      await this.inviteLinkService.createInviteLink(userId, this.organizationId(), domains);
    }

    this.form.markAsPristine();
    this.isDirty.set(false);
    this.isDirtyChange.emit(false);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("domainsEdited"),
    });
  };
}
