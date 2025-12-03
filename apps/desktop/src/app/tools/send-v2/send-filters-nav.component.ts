import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { Router } from "@angular/router";

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
  standalone: true,
  imports: [CommonModule, NavigationModule, I18nPipe],
})
export class SendFiltersNavComponent {
  protected readonly SendType = SendType;

  constructor(
    protected readonly filtersService: SendListFiltersService,
    private router: Router,
  ) {}

  // Computed: Is send route currently active?
  protected isSendRouteActive(): boolean {
    return this.router.url.includes("/new-sends");
  }

  // Computed: Is specific type currently active (on send route AND that filter is set)?
  protected isTypeActive(type: SendType): boolean {
    return this.isSendRouteActive() && this.filtersService.filterForm.value.sendType === type;
  }

  // Parent "Send" click: Clear filter, ensure on send route
  protected selectAllAndNavigate(): void {
    this.filtersService.filterForm.patchValue({ sendType: null });

    if (!this.isSendRouteActive()) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/new-sends"]);
    }
  }

  // Child "Text"/"File" click: Set filter, ensure on send route
  protected selectTypeAndNavigate(type: SendType): void {
    this.filtersService.filterForm.patchValue({ sendType: type });

    if (!this.isSendRouteActive()) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/new-sends"]);
    }
  }
}
