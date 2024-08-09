import { CommonModule } from "@angular/common";
import { Component, Input, OnChanges, OnInit, SimpleChanges } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";

import { IconModule, Icon } from "../../../../components/src/icon";
import { SharedModule } from "../../../../components/src/shared";
import { TypographyModule } from "../../../../components/src/typography";
import { BitwardenLogoPrimary, BitwardenLogoWhite } from "../icons";
import { BitwardenShieldPrimary, BitwardenShieldWhite } from "../icons/bitwarden-shield.icon";

@Component({
  standalone: true,
  selector: "auth-anon-layout",
  templateUrl: "./anon-layout.component.html",
  imports: [IconModule, CommonModule, TypographyModule, SharedModule],
})
export class AnonLayoutComponent implements OnInit, OnChanges {
  @Input() title: string;
  @Input() subtitle: string;
  @Input() icon: Icon;
  @Input() showReadonlyHostname: boolean;
  @Input() hideLogo: boolean = false;
  @Input() hideFooter: boolean = false;
  @Input() decreaseTopPadding: boolean = false;
  /**
   * Max width of the layout content
   *
   * @default 'md'
   */
  @Input() maxWidth: "md" | "3xl" = "md";

  protected logo: Icon;

  protected year = "2024";
  protected clientType: ClientType;
  protected hostname: string;
  protected version: string;
  protected theme: string;

  protected hideYearAndVersion = false;

  constructor(
    private environmentService: EnvironmentService,
    private platformUtilsService: PlatformUtilsService,
    private themeStateService: ThemeStateService,
  ) {
    this.year = new Date().getFullYear().toString();
    this.clientType = this.platformUtilsService.getClientType();
    this.hideYearAndVersion = this.clientType !== ClientType.Web;
  }

  async ngOnInit() {
    this.maxWidth = this.maxWidth ?? "md";

    this.theme = await firstValueFrom(this.themeStateService.selectedTheme$);

    if (this.theme === "dark") {
      this.logo = BitwardenLogoWhite;
    } else {
      this.logo = BitwardenLogoPrimary;
    }

    await this.updateIcon(this.theme);

    this.hostname = (await firstValueFrom(this.environmentService.environment$)).getHostname();
    this.version = await this.platformUtilsService.getApplicationVersion();
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes.icon) {
      const theme = await firstValueFrom(this.themeStateService.selectedTheme$);
      await this.updateIcon(theme);
    }
  }

  private async updateIcon(theme: string) {
    if (this.icon == null) {
      if (theme === "dark") {
        this.icon = BitwardenShieldWhite;
      }

      if (theme !== "dark") {
        this.icon = BitwardenShieldPrimary;
      }
    }
  }
}
