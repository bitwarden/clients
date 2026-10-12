import { DestroyRef, Directive, ElementRef, inject, input, OnInit, signal } from "@angular/core";
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
  host: {
    "[attr.src]": "src()",
  },
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
  readonly darkImgSrc = input.required<string>({ alias: "appDarkImgSrc" });

  /**
   * A signal rather than a plain field so that hosts using `OnPush` repaint when the theme
   * changes — the subscription below is not a change-detection trigger on its own.
   */
  protected readonly src = signal<string | undefined>(undefined);

  ngOnInit() {
    // Set the light image source from the element's current src attribute
    this.lightImgSrc = this.el.nativeElement.getAttribute("src");

    // Update the image source based on the active theme
    combineLatest([this.themeService.selectedTheme$, this.systemTheme$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([theme, systemTheme]) => {
        const appliedTheme = theme === "system" ? systemTheme : theme;
        const isDark = appliedTheme === "dark";
        this.src.set(isDark ? this.darkImgSrc() : this.lightImgSrc);
      });
  }
}
