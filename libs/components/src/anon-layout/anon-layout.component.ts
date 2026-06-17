import { CommonModule } from "@angular/common";
import {
  Component,
  HostBinding,
  OnChanges,
  OnInit,
  SimpleChanges,
  computed,
  input,
  model,
} from "@angular/core";
import { RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { BitwardenLogo, BitSvg } from "@bitwarden/assets/svg";
import { ClientType } from "@bitwarden/common/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  ContentVerticalPaddingType,
  FooterVerticalPaddingType,
  HeroTextAlignmentType,
  LandingContentMaxWidthType,
} from "../landing-layout";
import { LandingLayoutModule } from "../landing-layout/landing-layout.module";
import { SvgModule } from "../svg";
import { TypographyModule } from "../typography";

import { ANON_LAYOUT_DEFAULTS } from "./anon-layout-defaults";

export type SecondaryContentLocationType = "main" | "footer";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "auth-anon-layout",
  templateUrl: "./anon-layout.component.html",
  imports: [CommonModule, I18nPipe, SvgModule, TypographyModule, RouterModule, LandingLayoutModule],
})
export class AnonLayoutComponent implements OnInit, OnChanges {
  @HostBinding("class")
  get classList() {
    // AnonLayout should take up full height of parent container for proper footer placement.
    return ["tw-h-full"];
  }

  readonly title = input<string>();
  readonly subtitle = input<string>();
  readonly icon = model.required<BitSvg | null>();
  readonly showReadonlyHostname = input<boolean>(ANON_LAYOUT_DEFAULTS.showReadonlyHostname);
  readonly hideLogo = input<boolean>(false);
  readonly hideFooter = input<boolean>(false);
  readonly hideCardWrapper = input<boolean>(ANON_LAYOUT_DEFAULTS.hideCardWrapper);
  readonly hideBackgroundIllustration = input<boolean>(
    ANON_LAYOUT_DEFAULTS.hideBackgroundIllustration,
  );

  readonly hidePageIcon = input<boolean>(ANON_LAYOUT_DEFAULTS.hidePageIcon);
  readonly contentVerticalPadding = input<ContentVerticalPaddingType>(
    ANON_LAYOUT_DEFAULTS.contentVerticalPadding,
  );
  readonly footerVerticalPadding = input<FooterVerticalPaddingType>(
    ANON_LAYOUT_DEFAULTS.footerVerticalPadding,
  );
  readonly heroTextAlignment = input<HeroTextAlignmentType>(ANON_LAYOUT_DEFAULTS.heroTextAlignment);
  readonly secondaryContentLocation = input<SecondaryContentLocationType>(
    ANON_LAYOUT_DEFAULTS.secondaryContentLocation,
  );

  protected readonly footerLayoutClasses = computed(() =>
    this.secondaryContentLocation() === "footer" ? "tw-grid tw-gap-6" : "",
  );

  /**
   * Max width of the anon layout title, subtitle, and content areas.
   *
   * @default 'md'
   */
  readonly maxWidth = model<LandingContentMaxWidthType>(ANON_LAYOUT_DEFAULTS.maxWidth);

  protected logo = BitwardenLogo;
  protected year: string;
  protected clientType: ClientType;
  protected hostname?: string;
  protected version?: string;

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
    this.maxWidth.set(this.maxWidth() ?? ANON_LAYOUT_DEFAULTS.maxWidth);
    this.hostname = (await firstValueFrom(this.environmentService.environment$)).getHostname();
    this.version = await this.platformUtilsService.getApplicationVersion();
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes.maxWidth) {
      this.maxWidth.set(changes.maxWidth.currentValue ?? ANON_LAYOUT_DEFAULTS.maxWidth);
    }
  }
}
