import { FocusKeyManager } from "@angular/cdk/a11y";
import { AfterContentInit, Component, forwardRef, input, contentChildren } from "@angular/core";

import { TabHeaderComponent } from "../shared/tab-header.component";
import { TabListContainerDirective } from "../shared/tab-list-container.directive";

import { TabLinkComponent } from "./tab-link.component";

@Component({
  selector: "bit-tab-nav-bar",
  templateUrl: "tab-nav-bar.component.html",
  host: {
    class: "tw-block",
  },
  imports: [TabHeaderComponent, TabListContainerDirective],
})
export class TabNavBarComponent implements AfterContentInit {
  readonly tabLabels = contentChildren(forwardRef(() => TabLinkComponent));
  readonly label = input("");

  /**
   * Focus key manager for keeping tab controls accessible.
   * https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/tablist_role#keyboard_interactions
   */
  keyManager?: FocusKeyManager<TabLinkComponent>;

  ngAfterContentInit(): void {
    this.keyManager = new FocusKeyManager(this.tabLabels())
      .withHorizontalOrientation("ltr")
      .withWrap()
      .withHomeAndEnd();
  }

  updateActiveLink() {
    // Keep the keyManager in sync with active tabs
    const items = this.tabLabels();
    for (let i = 0; i < items.length; i++) {
      if (items[i].active) {
        this.keyManager?.updateActiveItem(i);
      }
    }
  }
}
