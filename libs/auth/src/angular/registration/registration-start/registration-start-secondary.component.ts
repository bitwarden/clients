// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LinkModule } from "@bitwarden/components";

/**
 * RegistrationStartSecondaryComponentData
 * @loginRoute: string - The client specific route to the login page - configured at the app-routing.module level.
 */
export interface RegistrationStartSecondaryComponentData {
  loginRoute: string;
}

@Component({
  standalone: true,
  selector: "auth-registration-start-secondary",
  templateUrl: "./registration-start-secondary.component.html",
  imports: [CommonModule, JslibModule, RouterModule, LinkModule],
})
export class RegistrationStartSecondaryComponent implements OnInit {
  loginRoute: string;

  constructor(private activatedRoute: ActivatedRoute) {}

  async ngOnInit() {
    const routeData = await firstValueFrom(this.activatedRoute.data);

    this.loginRoute = routeData["loginRoute"];
  }
}
