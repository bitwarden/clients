import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";

import { IconModule, Icon } from "../../../../components/src/icon";
import { SharedModule } from "../../../../components/src/shared";
import { TypographyModule } from "../../../../components/src/typography";
import { BitwardenLogoPrimary, BitwardenLogoWhite } from "../icons/bitwarden-logo.icon";

@Component({
  standalone: true,
  selector: "auth-anon-layout",
  templateUrl: "./anon-layout.component.html",
  imports: [IconModule, CommonModule, TypographyModule, SharedModule],
})
export class AnonLayoutComponent {
  @Input() title: string;
  @Input() subtitle: string;
  @Input() icon: Icon;
  @Input() showReadonlyHostname: boolean;

  protected logo: Icon;

  protected year = "2024";
  protected clientType: ClientType;
  protected hostname: string;
  protected version: string;
  protected theme: string;

  protected showYearAndVersion = true;

  constructor(
    private environmentService: EnvironmentService,
    private platformUtilsService: PlatformUtilsService,
    private themeStateService: ThemeStateService,
  ) {
    this.year = new Date().getFullYear().toString();
    this.clientType = this.platformUtilsService.getClientType();
    this.showYearAndVersion = this.clientType === ClientType.Web;
  }

  async ngOnInit() {
    this.hostname = (await firstValueFrom(this.environmentService.environment$)).getHostname();
    this.version = await this.platformUtilsService.getApplicationVersion();
    this.theme = await firstValueFrom(this.themeStateService.selectedTheme$);

    if (this.theme === "dark") {
      this.logo = BitwardenLogoWhite;
    } else {
      this.logo = BitwardenLogoPrimary;
    }
  }
}
