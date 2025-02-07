import { Component } from "@angular/core";

import { SharedModule } from "../../../shared";

@Component({
  selector: "app-send-access-explainer",
  templateUrl: "send-access-explainer.component.html",
  standalone: true,
  imports: [SharedModule],
})
export class SendAccessExplainerComponent {
  constructor() {}
}
