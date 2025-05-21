// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { Subject, firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, IconModule } from "@bitwarden/components";

import { RegistrationExpiredLinkIcon } from "../../icons/registration-expired-link.icon";

/**
 * RegistrationLinkExpiredComponentData
 * @loginRoute: string - The client specific route to the login page - configured at the app-routing.module level.
 */
export interface RegistrationLinkExpiredComponentData {
  loginRoute: string;
}

@Component({
  standalone: true,
  selector: "auth-registration-link-expired",
  templateUrl: "./registration-link-expired.component.html",
  imports: [CommonModule, JslibModule, RouterModule, IconModule, ButtonModule],
})
export class RegistrationLinkExpiredComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loginRoute: string;

  readonly Icons = { RegistrationExpiredLinkIcon };

  constructor(private activatedRoute: ActivatedRoute) {}

  async ngOnInit() {
    const routeData = await firstValueFrom(this.activatedRoute.data);

    this.loginRoute = routeData["loginRoute"];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
