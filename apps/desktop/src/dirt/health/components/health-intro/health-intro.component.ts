import { ChangeDetectionStrategy, Component, computed, inject, output } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { ButtonModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

// Relative to the renderer document; webpack copies `src/images` to `images`.
const INTRO_IMAGE_LIGHT = "images/health-tab/health_intro.png";
const INTRO_IMAGE_DARK = "images/health-tab/health_intro_dark.png";

/** The Health page's first-visit view; the page root starts the scan. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-health-intro",
  templateUrl: "./health-intro.component.html",
  imports: [ButtonModule, TypographyModule, I18nPipe],
})
export class HealthIntroComponent {
  private readonly themingService = inject(AbstractThemingService);

  private readonly darkTheme = toSignal(
    this.themingService.theme$.pipe(map((theme) => theme === ThemeTypes.Dark)),
    { initialValue: false },
  );

  protected readonly introImage = computed(() =>
    this.darkTheme() ? INTRO_IMAGE_DARK : INTRO_IMAGE_LIGHT,
  );

  readonly onTriggerHealthScan = output<void>();

  protected readonly handleScanVaultClick = () => {
    this.onTriggerHealthScan.emit();
  };
}
