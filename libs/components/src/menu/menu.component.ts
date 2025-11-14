import { FocusKeyManager, CdkTrapFocus } from "@angular/cdk/a11y";
import {
  Component,
  Output,
  TemplateRef,
  EventEmitter,
  AfterContentInit,
  input,
  viewChild,
  contentChildren,
} from "@angular/core";

import { MenuItemComponent } from "./menu-item.directive";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-menu",
  templateUrl: "./menu.component.html",
  exportAs: "menuComponent",
  imports: [CdkTrapFocus],
})
export class MenuComponent implements AfterContentInit {
  readonly templateRef = viewChild.required(TemplateRef);
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() closed = new EventEmitter<void>();
  readonly menuItems = contentChildren(MenuItemComponent, { descendants: true });
  keyManager?: FocusKeyManager<MenuItemComponent>;

  readonly ariaRole = input<"menu" | "dialog">("menu");

  readonly ariaLabel = input<string>();

  ngAfterContentInit() {
    if (this.ariaRole() === "menu") {
      this.keyManager = new FocusKeyManager(this.menuItems())
        .withWrap()
        .skipPredicate((item) => !!item.disabled);
    }
  }
}
