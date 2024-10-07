import { CommonModule } from "@angular/common";
import { Component, Input, OnChanges, OnInit, SimpleChanges } from "@angular/core";
import { RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { IconModule, Icon } from "../../../../components/src/icon";
import { SharedModule } from "../../../../components/src/shared";
import { TypographyModule } from "../../../../components/src/typography";
import { BitwardenLogo, VaultIcon } from "../icons";

@Component({
  standalone: true,
  selector: "auth-anon-layout",
  templateUrl: "./anon-layout.component.html",
  imports: [IconModule, CommonModule, TypographyModule, SharedModule, RouterModule],
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

  protected logo = BitwardenLogo;
  protected year = "2024";
  protected clientType: ClientType;
  protected hostname: string;
  protected version: string;

  protected hideYearAndVersion = false;

  constructor(
    private environmentService: EnvironmentService,
    private platformUtilsService: PlatformUtilsService,
  ) {
    this.year = new Date().getFullYear().toString();
    this.clientType = this.platformUtilsService.getClientType();
    this.hideYearAndVersion = this.clientType !== ClientType.Web;
  }

  async ngOnInit() {
    this.maxWidth = this.maxWidth ?? "md";
    this.hostname = (await firstValueFrom(this.environmentService.environment$)).getHostname();
    this.version = await this.platformUtilsService.getApplicationVersion();

    // If there is no icon input, then use the default icon
    if (this.icon == null) {
      this.icon = VaultIcon;
    }
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes.maxWidth) {
      this.maxWidth = changes.maxWidth.currentValue ?? "md";
    }
  }
}
