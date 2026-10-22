import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountWarning } from "@bitwarden/assets/svg";
import {
  AnonLayoutWrapperDataService,
  ButtonModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Terminal error view for the pre-auth open org invite link domain-check when the server
 * returns 404 (link deleted, regenerated, or tampered URL). Consolidates the invalid-link
 * UI in one place so `LoginComponent` and `RegistrationStartComponent` don't each carry
 * their own view-state for it — they clear the stashed invite and `router.navigate` here
 * with two query params: `orgName` (interpolated into the anon-layout title) and
 * `returnTo` (either `"login"` or `"registration"`, driving the CTA label + destination).
 * A missing/invalid `returnTo` defaults to registration.
 */
@Component({
  templateUrl: "open-org-invite-link-invalid.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, RouterLink, TypographyModule, I18nPipe],
})
export class OpenOrgInviteLinkInvalidComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly anonLayoutWrapperDataService = inject(AnonLayoutWrapperDataService);

  protected readonly returnRoute = signal<string>("/signup");
  protected readonly returnLabelKey = signal<string>("returnToRegistration");

  async ngOnInit(): Promise<void> {
    const qParams = await firstValueFrom(this.route.queryParams);
    const orgName = qParams.orgName ?? "";
    if (qParams.returnTo === "login") {
      this.returnRoute.set("/login");
      this.returnLabelKey.set("returnToLogin");
    }
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageTitle: {
        key: "unableToJoinOrganizationName",
        placeholders: [orgName],
      },
      pageIcon: AccountWarning,
    });
  }
}
