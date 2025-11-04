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

import {
  BackgroundLeftIllustration,
  BackgroundRightIllustration,
  BitwardenLogo,
  Icon,
} from "@bitwarden/assets/svg";
import { ClientType } from "@bitwarden/common/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { BaseCardComponent } from "../card";
import { IconModule } from "../icon";
import { SharedModule } from "../shared";
import { TypographyModule } from "../typography";

export type AnonLayoutMaxWidth = "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "auth-anon-layout",
  templateUrl: "./anon-layout.component.html",
  imports: [
    IconModule,
    CommonModule,
    TypographyModule,
    SharedModule,
    RouterModule,
    BaseCardComponent,
  ],
})
export class AnonLayoutComponent implements OnInit, OnChanges {
  @HostBinding("class")
  get classList() {
    // AnonLayout should take up full height of parent container for proper footer placement.
    return ["tw-h-full"];
  }

  readonly leftIllustration = BackgroundLeftIllustration;
  readonly rightIllustration = BackgroundRightIllustration;

  readonly title = input<string>();
  readonly subtitle = input<string>();
  readonly icon = model.required<Icon | null>();
  readonly showReadonlyHostname = input<boolean>(false);
  readonly hideLogo = input<boolean>(false);
  readonly hideFooter = input<boolean>(false);
  readonly hideCardWrapper = input<boolean>(false);
  readonly hideBackgroundIllustration = input<boolean>(false);

  /**
   * Max width of the anon layout title, subtitle, and content areas.
   *
   * @default 'md'
   */
  readonly maxWidth = model<AnonLayoutMaxWidth>("md");

  protected logo = BitwardenLogo;
  protected year: string;
  protected clientType: ClientType;
  protected hostname?: string;
  protected version?: string;

  protected hideYearAndVersion = false;

  get maxWidthClass(): string {
    const maxWidth = this.maxWidth();
    switch (maxWidth) {
      case "md":
        return "tw-max-w-md";
      case "lg":
        return "tw-max-w-lg";
      case "xl":
        return "tw-max-w-xl";
      case "2xl":
        return "tw-max-w-2xl";
      case "3xl":
        return "tw-max-w-3xl";
      case "4xl":
        return "tw-max-w-4xl";
    }
  }

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
    this.hostname = (await firstValueFrom(this.environmentService.environment$)).getHostname();
    this.version = await this.platformUtilsService.getApplicationVersion();
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes.maxWidth) {
      this.maxWidth.set(changes.maxWidth.currentValue ?? "md");
    }
  }
}
