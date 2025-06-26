// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import {
  Component,
  HostBinding,
  OnChanges,
  OnInit,
  SimpleChanges,
  input,
  model,
} from "@angular/core";
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

  readonly title = input<string>();
  readonly subtitle = input<string>();
  icon = model<Icon>();
  readonly showReadonlyHostname = input<boolean>(false);
  readonly hideLogo = input<boolean>(false);
  readonly hideFooter = input<boolean>(false);
  readonly hideIcon = input<boolean>(false);

  /**
   * Max width of the title area content
   *
   * @default undefined
   */
  titleAreaMaxWidth = model<"md">();

  /**
   * Max width of the layout content
   *
   * @default 'md'
   */
  maxWidth = model<"md" | "3xl">("md");

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
    this.maxWidth.set(this.maxWidth() ?? "md");
    this.titleAreaMaxWidth.set(this.titleAreaMaxWidth() ?? null);
    this.hostname = (await firstValueFrom(this.environmentService.environment$)).getHostname();
    this.version = await this.platformUtilsService.getApplicationVersion();

    // If there is no icon input, then use the default icon
    if (this.icon() == null) {
      this.icon.set(BitwardenShield);
    }
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes.maxWidth) {
      this.maxWidth.set(changes.maxWidth.currentValue ?? "md");
    }
  }
}
