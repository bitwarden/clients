import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule } from "@bitwarden/components";

@Component({
  standalone: true,
  templateUrl: "learn-more-component.html",
  imports: [CommonModule, CommonModule, JslibModule, ButtonModule],
})
export class LearnMoreComponent {
  constructor() {}
}
