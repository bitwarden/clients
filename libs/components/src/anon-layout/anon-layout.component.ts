// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, HostBinding, Input, OnChanges, OnInit, SimpleChanges } from "@angular/core";
import { RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { IconModule, Icon } from "../icon";
import { BitwardenLogo, BitwardenShield } from "../icon/icons";
import { SharedModule } from "../shared";
import { TypographyModule } from "../typography";

@Component({
  selector: "auth-anon-layout",
  templateUrl: "./anon-layout.component.html",
  imports: [IconModule, CommonModule, TypographyModule, SharedModule, RouterModule],
})
export class AnonLayoutComponent implements OnInit, OnChanges {
  @HostBinding("class")
  get classList() {
    // AnonLayout should take up full height of parent container for proper footer placement.
    return ["tw-h-full"];
  }

  @Input() title: string;
  @Input() subtitle: string;
  @Input() icon: Icon;
  @Input() showReadonlyHostname: boolean;
  @Input() hideLogo: boolean = false;
  @Input() hideFooter: boolean = false;
  @Input() hideIcon: boolean = false;

  /**
   * Max width of the title area content
   *
   * @default null
   */
  @Input() titleAreaMaxWidth?: "md";

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
    this.titleAreaMaxWidth = this.titleAreaMaxWidth ?? null;
    this.hostname = (await firstValueFrom(this.environmentService.environment$)).getHostname();
    this.version = await this.platformUtilsService.getApplicationVersion();

    // If there is no icon input, then use the default icon
    if (this.icon == null) {
      this.icon = BitwardenShield;
    }
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes.maxWidth) {
      this.maxWidth = changes.maxWidth.currentValue ?? "md";
    }
  }
}
