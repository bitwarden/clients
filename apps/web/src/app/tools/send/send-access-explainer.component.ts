import { Component } from "@angular/core";

import { RegisterRouteService } from "@bitwarden/auth/common";

import { SharedModule } from "../../shared";

@Component({
  selector: "app-send-access-explainer",
  templateUrl: "send-access-explainer.component.html",
  standalone: true,
  imports: [SharedModule],
})
export class SendAccessExplainerComponent {
  // TODO: remove when email verification flag is removed
  registerRoute$ = this.registerRouteService.registerRoute$();
  constructor(private registerRouteService: RegisterRouteService) {}
}
