import { ChangeDetectionStrategy, Component, computed, inject, output } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { TypographyModule, ButtonModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Extension-root paths for the intro images. `src/images` is copied to `/images`
 * at build time, so these resolve at runtime without going through the bundler.
 */
const BACKGROUND_LIGHT = "/images/health-tab/health_intro_bg_light.png";
const BACKGROUND_DARK = "/images/health-tab/health_intro_bg_dark.png";
const INTRO_IMAGE = "/images/health-tab/health_intro.png";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "health-intro",
  templateUrl: "./health-intro.component.html",
  standalone: true,
  imports: [ButtonModule, TypographyModule, I18nPipe],
})
export class HealthIntroComponent {
  private readonly themingService = inject(AbstractThemingService);

  private readonly darkTheme = toSignal(
    this.themingService.theme$.pipe(map((theme) => theme === ThemeTypes.Dark)),
    { initialValue: false },
  );

  protected readonly backgroundImage = computed(
    () => `url("${this.darkTheme() ? BACKGROUND_DARK : BACKGROUND_LIGHT}")`,
  );
  protected readonly introImage = INTRO_IMAGE;

  readonly onTriggerHealthScan = output<void>();

  readonly handleScanVaultClick = () => {
    this.onTriggerHealthScan.emit();
  };
}
