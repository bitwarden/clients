import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";

import { SharedModule } from "../../shared";

@Component({
  selector: "tools-applications-loading",
  standalone: true,
  imports: [CommonModule, JslibModule, SharedModule],
  templateUrl: "./applications-loading.component.html",
})
export class ApplicationsLoadingComponent {
  constructor() {}
}
