import { Component, ChangeDetectionStrategy, signal } from "@angular/core";

import { CurrentAccountComponent } from "@bitwarden/browser/auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "@bitwarden/browser/platform/popup/layout/popup-page.component";
import {
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
  ButtonModule,
  IconButtonModule,
} from "@bitwarden/components";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "health-risk-category-detail",
  templateUrl: "./health-risk-category-detail.component.html",
  imports: [
    ItemModule,
    TypographyModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    SectionComponent,
    SectionHeaderComponent,
    ButtonModule,
    IconButtonModule,
  ],
})
export class HealthRiskCategoryDetailComponent {
  readonly items = signal([
    {
      url: "https://facebook.com",
      name: "Example Item",
      username: "example@example.com",
    },
    {
      url: "https://twitter.com",
      name: "Another Item",
      username: "test@example.com",
    },
  ]);
}
