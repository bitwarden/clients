import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, NoItemsModule, Icons } from "@bitwarden/components";

@Component({
  standalone: true,
  selector: "tools-no-priority-apps",
  templateUrl: "no-priority-apps.component.html",
  imports: [ButtonModule, CommonModule, JslibModule, NoItemsModule],
})
export class NoPriorityAppsComponent {
  noItemsIcon = Icons.NoResults;
}
