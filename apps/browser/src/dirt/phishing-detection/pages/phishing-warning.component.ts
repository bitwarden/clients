// eslint-disable-next-line no-restricted-imports
import { CommonModule } from "@angular/common";
// eslint-disable-next-line no-restricted-imports
import { Component, inject } from "@angular/core";
// eslint-disable-next-line no-restricted-imports
import { ActivatedRoute, RouterModule } from "@angular/router";
import { map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  FormFieldModule,
  IconModule,
  IconTileComponent,
  LinkModule,
  CalloutComponent,
  TypographyModule,
} from "@bitwarden/components";

import { PhishingDetectionService } from "../services/phishing-detection.service";

@Component({
  selector: "dirt-phishing-warning",
  standalone: true,
  templateUrl: "phishing-warning.component.html",
  imports: [
    CommonModule,
    IconModule,
    JslibModule,
    LinkModule,
    FormFieldModule,
    AsyncActionsModule,
    CheckboxModule,
    ButtonModule,
    RouterModule,
    IconTileComponent,
    CalloutComponent,
    TypographyModule,
  ],
})
export class PhishingWarning {
  private activatedRoute = inject(ActivatedRoute);
  protected phishingHost$ = this.activatedRoute.queryParamMap.pipe(
    map((params) => params.get("phishingHost") || ""),
  );

  async closeTab() {
    await PhishingDetectionService.requestClosePhishingWarningPage();
  }
  async continueAnyway() {
    await PhishingDetectionService.requestContinueToDangerousUrl();
  }
}
