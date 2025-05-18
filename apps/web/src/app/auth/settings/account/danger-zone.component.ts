// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { TypographyModule } from "@bitwarden/components";

/**
 * Component for the Danger Zone section of the Account/Organization Settings page.
 */
@Component({
  selector: "app-danger-zone",
  templateUrl: "danger-zone.component.html",
  standalone: true,
  imports: [TypographyModule, JslibModule, CommonModule],
})
export class DangerZoneComponent {}
