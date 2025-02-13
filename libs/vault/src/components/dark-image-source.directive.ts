import {
  DestroyRef,
  Directive,
  ElementRef,
  HostBinding,
  inject,
  input,
  OnInit,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { combineLatest, Observable } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { Theme } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";

/**
 * Directive that will switch the image source based on the currently applied theme.
 *
 * @example
 * ```html
 * <img src="light-image.png" appDarkImgSrc="dark-image.png" />
 * ```
 */
@Directive({
  selector: "[appDarkImgSrc]",
  standalone: true,
})
export class DarkImageSourceDirective implements OnInit {
  private themeService = inject(ThemeStateService);
  private systemTheme$: Observable<Theme> = inject(SYSTEM_THEME_OBSERVABLE);
  private el = inject(ElementRef<HTMLElement>);
  private destroyRef = inject(DestroyRef);

  /**
   * The image source to use when the light theme is applied. Automatically assigned the value
   * of the `<img>` src attribute.
   */
  protected lightImgSrc: string | undefined;

  /**
   * The image source to use when the dark theme is applied.
   */
  darkImgSrc = input.required<string>({ alias: "appDarkImgSrc" });

  @HostBinding("attr.src") src: string | undefined;

  ngOnInit() {
    // Set the light image source from the element's current src attribute
    this.lightImgSrc = this.el.nativeElement.getAttribute("src");

    // Update the image source based on the active theme
    combineLatest([this.themeService.selectedTheme$, this.systemTheme$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([theme, systemTheme]) => {
        const appliedTheme = theme === "system" ? systemTheme : theme;
        const isDark =
          appliedTheme === "dark" || appliedTheme === "nord" || appliedTheme === "solarizedDark";
        this.src = isDark ? this.darkImgSrc() : this.lightImgSrc;
      });
  }
}
