import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injectable,
  input,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { BannerModule, LinkModule, ResizeObserverDirective } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

const HEIGHT_PROPERTY = "--private-access-banner-height";

/**
 * Where a banner instance is rendered. `app` sits above the router outlet and covers routes
 * without `bit-layout`; `layout` sits inside `bit-layout`'s focus trap so its link stays
 * keyboard reachable, and suppresses the `app` instance while it is mounted.
 */
export type PrivateAccessBannerPlacement = "app" | "layout";

@Injectable({ providedIn: "root" })
export class PrivateAccessBannerPlacementService {
  private readonly layoutBanners = signal(0);

  readonly layoutBannerMounted = computed(() => this.layoutBanners() > 0);

  mountLayoutBanner(): () => void {
    this.layoutBanners.update((count) => count + 1);
    return () => this.layoutBanners.update((count) => count - 1);
  }
}

/** Marks the deployment as a private access environment on every route. */
@Component({
  selector: "app-private-access-banner",
  templateUrl: "private-access-banner.component.html",
  imports: [BannerModule, LinkModule, I18nPipe, ResizeObserverDirective],
  host: {
    class: "tw-sticky tw-z-20 tw-block tw-pointer-events-none",
    "[class]": "offsetClass()",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivateAccessBannerComponent implements OnInit, AfterViewInit, OnDestroy {
  // Directory URL, not `index.html`: both the self-host static server (`UseDefaultFiles`)
  // and webpack-dev-server resolve it to `index.html`. The trailing slash is load-bearing —
  // without it the server 301s to add it, and the guide's relative asset paths would
  // otherwise resolve against `/help/`.
  protected readonly helpUrl = "/help/privileged-controls/";

  readonly placement = input<PrivateAccessBannerPlacement>("app");

  private readonly placementService = inject(PrivateAccessBannerPlacementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly container = viewChild<ElementRef<HTMLElement>>("container");

  private readonly vfo1Enabled = toSignal(
    inject(ConfigService).getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  /**
   * Sticky insets are measured inside the scroll container's padding, so the layout instance
   * offsets `<main>`'s top padding to pin flush with its top edge. Mirrors the padding
   * correction in `bit-banner`.
   */
  protected readonly offsetClass = computed(() => {
    if (this.placement() === "app") {
      return "tw-top-0";
    }
    return this.vfo1Enabled() ? "-tw-top-6 [main:has(bit-header)>&]:tw-top-0" : "-tw-top-6";
  });

  protected readonly visible = computed(
    () => this.placement() === "layout" || !this.placementService.layoutBannerMounted(),
  );

  private readonly publishesHeight = computed(() => this.placement() === "app" && this.visible());

  constructor() {
    effect(() => {
      if (this.placement() === "app" && !this.visible()) {
        document.documentElement.style.removeProperty(HEIGHT_PROPERTY);
      }
    });
  }

  ngOnInit() {
    if (this.placement() === "layout") {
      this.destroyRef.onDestroy(this.placementService.mountLayoutBanner());
    }
  }

  ngAfterViewInit() {
    this.publishHeight();
  }

  ngOnDestroy() {
    if (this.placement() === "app") {
      document.documentElement.style.removeProperty(HEIGHT_PROPERTY);
    }
  }

  protected publishHeight() {
    const container = this.container();
    if (!this.publishesHeight() || !container) {
      return;
    }

    const height = `${container.nativeElement.getBoundingClientRect().height}px`;
    const root = document.documentElement;

    if (root.style.getPropertyValue(HEIGHT_PROPERTY) !== height) {
      root.style.setProperty(HEIGHT_PROPERTY, height);
    }
  }
}
