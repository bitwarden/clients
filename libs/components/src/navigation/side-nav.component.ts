import { CdkTrapFocus } from "@angular/cdk/a11y";
import { DragDropModule, CdkDragEnd, CdkDragMove } from "@angular/cdk/drag-drop";
import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  viewChild,
  inject,
  effect,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

import { NavDividerComponent } from "./nav-divider.component";
import { media, SideNavService } from "./side-nav.service";

export type SideNavVariant = "primary" | "secondary";

/**
 * Side navigation component that provides a collapsible navigation menu.
 */
@Component({
  selector: "bit-side-nav",
  templateUrl: "side-nav.component.html",
  imports: [
    CdkTrapFocus,
    NavDividerComponent,
    BitIconButtonComponent,
    I18nPipe,
    DragDropModule,
    NgTemplateOutlet,
  ],
  host: {
    // Grid placement: always col 1.  In overlay mode the element is also
    // switched to position:fixed so it escapes the grid's stacking context
    // and renders above the scrim (z-40) and the drawer.
    class: "tw-block tw-h-full tw-col-start-1 tw-row-start-1",
    "[class]":
      "sideNavService.isOverlay() ? 'tw-fixed tw-top-0 tw-bottom-0 tw-left-0 tw-z-50' : ''",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideNavComponent {
  protected readonly sideNavService = inject(SideNavService);

  /**
   * Visual variant of the side navigation
   *
   * @default "primary"
   */
  readonly variant = input<SideNavVariant>("primary");

  private readonly toggleButton = viewChild("toggleButton", { read: ElementRef });

  private readonly scrollContainer = viewChild<ElementRef<HTMLElement>>("scrollContainer");
  private readonly footerWrapper = viewChild<ElementRef<HTMLElement>>("footerWrapper");

  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly configService = inject(ConfigService);

  private readonly i18nService = inject(I18nService);

  /**
   * Whether the VFO1 Foundation flag is enabled, which selects the v2 side nav layout.
   */
  private readonly vfo1Enabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  protected readonly isTouchDevice = toSignal(media("(pointer: coarse)"), { initialValue: false });

  private readonly reducedMotion = toSignal(media("(prefers-reduced-motion: reduce)"), {
    initialValue: false,
  });

  /**
   * Spoken value for the resize handle. aria-valuenow alone would announce a bare number, and the
   * collapsed end of the range is a state rather than a width the user can land on.
   */
  protected readonly widthValueText = computed(() =>
    this.sideNavService.open()
      ? this.i18nService.t("sideNavigationWidth", this.sideNavService.widthRem().toString())
      : this.i18nService.t("sideNavigationCollapsed"),
  );

  /** True when it is safe to animate the nav's width. */
  protected readonly animateWidth = computed(
    () =>
      this.sideNavService.transitionsEnabled() &&
      !this.sideNavService.isDragging() &&
      !this.reducedMotion(),
  );

  protected readonly handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      this.sideNavService.open.set(false);
      this.toggleButton()?.nativeElement.focus();
      return false;
    }

    return true;
  };

  protected onDragMoved(event: CdkDragMove) {
    const rectX = this.elementRef.nativeElement.getBoundingClientRect().x;
    const eventXPointer = event.pointerPosition.x;

    this.sideNavService.setWidthFromDrag(eventXPointer, rectX);

    // Neutralize CDK's accumulated transform to prevent the handle from drifting
    // away from the nav's right edge as the nav width changes.
    event.source.element.nativeElement.style.transform = "none";
  }

  protected onDragEnded(event: CdkDragEnd) {
    this.sideNavService.onDragEnd();
    // Reset CDK's accumulated position so the next drag starts clean,
    // then clear the inline transform so the handle returns to its CSS position.
    event.source.reset();
    event.source.element.nativeElement.style.transform = "none";
  }

  protected onKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      this.sideNavService.setWidthFromKeys(event.key);
    }
  }

  protected scrollFocusedIntoView(event: FocusEvent) {
    const scrollContainer = this.scrollContainer()?.nativeElement;
    const footerWrapper = this.footerWrapper()?.nativeElement;
    if (!scrollContainer || !footerWrapper) {
      return;
    }

    const target = event.target as HTMLElement;
    // Focus inside the footer can never be occluded by it.
    if (footerWrapper.contains(target)) {
      return;
    }

    const overlap =
      target.getBoundingClientRect().bottom - footerWrapper.getBoundingClientRect().top;

    if (overlap > 0) {
      scrollContainer.scrollBy({ top: overlap, behavior: "instant" });
    }
  }

  constructor() {
    effect(() => {
      this.sideNavService.version.set(this.vfo1Enabled() ? "vfo1" : "default");
    });
  }
}
