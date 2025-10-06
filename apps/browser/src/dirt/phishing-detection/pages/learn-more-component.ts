// eslint-disable-next-line no-restricted-imports
import { CommonModule } from "@angular/common";
// eslint-disable-next-line no-restricted-imports
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, LinkModule } from "@bitwarden/components";

@Component({
  selector: "dirt-phishing-learn-more",
  standalone: true,
  templateUrl: "learn-more-component.html",
  imports: [CommonModule, CommonModule, JslibModule, ButtonModule, LinkModule],
})
export class LearnMoreComponent {
  constructor() {}
}
