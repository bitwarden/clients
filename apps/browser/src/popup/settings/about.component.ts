import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { Observable } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { ServerConfig } from "@bitwarden/common/platform/abstractions/config/server-config";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { ButtonModule, DialogModule } from "@bitwarden/components";

import { BrowserApi } from "../../platform/browser/browser-api";

@Component({
  templateUrl: "about.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule, DialogModule, ButtonModule],
})
export class AboutComponent {
  protected serverConfig$: Observable<ServerConfig> = this.configService.serverConfig$;

  protected year = new Date().getFullYear();
  protected version = BrowserApi.getApplicationVersion();
  protected isCloud = this.environmentService.isCloud();

  constructor(
    private configService: ConfigServiceAbstraction,
    private environmentService: EnvironmentService
  ) {}
}
