import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { startWith } from "rxjs";

import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { NavigationModule } from "@bitwarden/components";
import { SendListFiltersService } from "@bitwarden/send-ui";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Navigation component that renders Send filter options in the sidebar.
 * Follows reactive pattern: updates filter state, display component reacts.
 * - Parent "Send" nav-group clears filter (shows all sends)
 * - Child "Text"/"File" items set filter to specific type
 * - Active states computed from current filter value + route
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-send-filters-nav",
  templateUrl: "./send-filters-nav.component.html",
  imports: [CommonModule, NavigationModule, I18nPipe],
})
export class SendFiltersNavComponent {
  protected readonly SendType = SendType;

  // Inject services at class level
  protected readonly filtersService = inject(SendListFiltersService);
  private readonly router = inject(Router);

  // Convert filter form to signal for reactive updates
  protected readonly currentFilter = toSignal(
    this.filtersService.filterForm.valueChanges.pipe(
      startWith(this.filtersService.filterForm.value),
    ),
    { initialValue: this.filtersService.filterForm.value },
  );

  // Computed: Is send route currently active?
  protected isSendRouteActive(): boolean {
    return this.router.url.includes("/new-sends");
  }

  // Computed: Is specific type currently active (on send route AND that filter is set)?
  protected isTypeActive(type: SendType): boolean {
    return this.isSendRouteActive() && this.currentFilter()?.sendType === type;
  }

  // Set filter and navigate to send route if needed
  // - No type parameter (undefined): clears filter (shows all sends)
  // - Specific type: filters to that send type
  protected async selectTypeAndNavigate(type?: SendType): Promise<void> {
    this.filtersService.filterForm.patchValue({ sendType: type !== undefined ? type : null });

    if (!this.isSendRouteActive()) {
      await this.router.navigate(["/new-sends"]);
    }
  }
}
