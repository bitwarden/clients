import { FocusableOption } from "@angular/cdk/a11y";
import {
  AfterViewInit,
  Component,
  DestroyRef,
  HostListener,
  Input,
  inject,
  input,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { IsActiveMatchOptions, RouterLinkActive, RouterModule } from "@angular/router";

import { TabListItemDirective } from "../shared/tab-list-item.directive";

import { TabNavBarComponent } from "./tab-nav-bar.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-tab-link",
  templateUrl: "tab-link.component.html",
  imports: [TabListItemDirective, RouterModule],
})
export class TabLinkComponent implements FocusableOption, AfterViewInit {
  private destroyRef = inject(DestroyRef);

  readonly tabItem = viewChild.required(TabListItemDirective);
  readonly routerLinkActive = viewChild.required<RouterLinkActive>("rla");

  readonly routerLinkMatchOptions: IsActiveMatchOptions = {
    queryParams: "ignored",
    matrixParams: "ignored",
    paths: "subset",
    fragment: "ignored",
  };

  readonly route = input<string | any[]>();
  // TODO: Skipped for signal migration because:
  //  This input overrides a field from a superclass, while the superclass field
  //  is not migrated.
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() disabled = false;

  @HostListener("keydown", ["$event"]) onKeyDown(event: KeyboardEvent) {
    if (event.code === "Space") {
      this.tabItem().click();
    }
  }

  get active() {
    return this.routerLinkActive()?.isActive ?? false;
  }

  constructor(private _tabNavBar: TabNavBarComponent) {}

  focus(): void {
    this.tabItem().focus();
  }

  ngAfterViewInit() {
    // The active state of tab links are tracked via the routerLinkActive directive
    // We need to watch for changes to tell the parent nav group when the tab is active
    this.routerLinkActive()
      .isActiveChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((_) => this._tabNavBar.updateActiveLink());
  }
}
