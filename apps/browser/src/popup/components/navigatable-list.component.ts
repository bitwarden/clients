import { FocusKeyManager } from "@angular/cdk/a11y";
import { Component, ContentChildren, HostListener, QueryList } from "@angular/core";

import { NavigatableListItemComponent } from "./navigatable-list-item.component";

@Component({
  selector: "navigatable-list",
  host: { role: "list" },
  templateUrl: "navigatable-list.component.html",
})
export class NavigatableListComponent {
  private keyManager: FocusKeyManager<NavigatableListItemComponent>;

  @ContentChildren(NavigatableListItemComponent, { descendants: true })
  items: QueryList<NavigatableListItemComponent>;

  ngAfterContentInit() {
    this.keyManager = new FocusKeyManager(this.items);
  }

  @HostListener("keydown", ["$event"])
  onKeydown(event: KeyboardEvent) {
    this.keyManager.onKeydown(event);
  }

  focusTop() {
    this.keyManager.setFirstItemActive();
  }

  isFocused() {
    return this.keyManager.activeItemIndex != null;
  }
}
