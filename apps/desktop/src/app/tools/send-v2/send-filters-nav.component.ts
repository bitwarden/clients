import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { filter, map, startWith } from "rxjs";

import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { NavigationModule } from "@bitwarden/components";
import { SendListFiltersService } from "@bitwarden/send-ui";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Navigation component that renders Send filter options in the sidebar.
 * Fully reactive using signals - no manual subscriptions or method-based computed values.
 * - Parent "Send" nav-group clears filter (shows all sends)
 * - Child "Text"/"File" items set filter to specific type
 * - Active states computed reactively from filter signal + route signal
 */
@Component({
  selector: "app-send-filters-nav",
  templateUrl: "./send-filters-nav.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NavigationModule, I18nPipe],
})
export class SendFiltersNavComponent {
  protected readonly SendType = SendType;
  private readonly filtersService = inject(SendListFiltersService);
  private readonly router = inject(Router);
  private readonly currentFilter = toSignal(this.filtersService.filters$);

  // Track whether current route is the send route
  private readonly isSendRouteActive = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => (event as NavigationEnd).urlAfterRedirects.includes("/new-sends")),
      startWith(this.router.url.includes("/new-sends")),
    ),
    { initialValue: this.router.url.includes("/new-sends") },
  );

  // Computed: Active send type (null when on send route with no filter, undefined when not on send route)
  protected readonly activeSendType = computed(() => {
    return this.isSendRouteActive() ? this.currentFilter()?.sendType : undefined;
  });

  // Update send filter and navigate to /new-sends (only if not already there - send-v2 component reacts to filter changes)
  protected async selectTypeAndNavigate(type?: SendType): Promise<void> {
    this.filtersService.filterForm.patchValue({ sendType: type !== undefined ? type : null });

    if (!this.router.url.includes("/new-sends")) {
      await this.router.navigate(["/new-sends"]);
    }
  }
}
