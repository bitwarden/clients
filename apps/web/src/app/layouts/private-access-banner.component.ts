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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivateAccessBannerComponent implements OnInit, AfterViewInit, OnDestroy {
  // TODO(PM-43667): point at the private preview user guide once it exists.
  protected readonly helpUrl = "https://bitwarden.com/help/private-preview-user-guide";

  readonly placement = input<PrivateAccessBannerPlacement>("app");

  private readonly placementService = inject(PrivateAccessBannerPlacementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly container = viewChild<ElementRef<HTMLElement>>("container");

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
