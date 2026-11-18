import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, input, model } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { from, map } from "rxjs";

import { BitSvg } from "@bitwarden/assets/svg";
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

@Component({
  selector: "auth-anon-layout",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./anon-layout.component.html",
  host: {
    // AnonLayout should take up full height of parent container for proper footer placement.
    class: "tw-h-full",
  },
  imports: [CommonModule, I18nPipe, SvgModule, TypographyModule, RouterModule, LandingLayoutModule],
})
export class AnonLayoutComponent {
  private readonly environmentService = inject(EnvironmentService);
  private readonly platformUtilsService = inject(PlatformUtilsService);

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

  protected readonly resolvedMaxWidth = computed(
    () => this.maxWidth() ?? ANON_LAYOUT_DEFAULTS.maxWidth,
  );

  protected readonly year = new Date().getFullYear().toString();
  protected readonly hideYearAndVersion =
    this.platformUtilsService.getClientType() !== ClientType.Web;
  protected readonly hostname = toSignal(
    this.environmentService.environment$.pipe(map((env) => env.getHostname())),
  );
  protected readonly version = toSignal(from(this.platformUtilsService.getApplicationVersion()));
}
