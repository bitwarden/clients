// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BooleanInput, coerceBooleanProperty } from "@angular/cdk/coercion";
import { CommonModule } from "@angular/common";
import { Component, Input, Signal, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AsyncActionsModule,
  FunctionReturningAwaitable,
  IconButtonModule,
  TypographyModule,
} from "@bitwarden/components";

import { PopupRouterCacheService } from "../view-cache/popup-router-cache.service";

import { PopupPageComponent } from "./popup-page.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "popup-header",
  templateUrl: "popup-header.component.html",
  imports: [TypographyModule, CommonModule, IconButtonModule, JslibModule, AsyncActionsModule],
})
export class PopupHeaderComponent {
  private popupRouterCacheService = inject(PopupRouterCacheService);
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  protected pageContentScrolled: Signal<boolean> = inject(PopupPageComponent).isScrolled;

  /** Background color */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  background: "default" | "alt" = "default";

  /** Display the back button, which uses Location.back() to go back one page in history */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  get showBackButton() {
    return this._showBackButton;
  }
  set showBackButton(value: BooleanInput) {
    this._showBackButton = coerceBooleanProperty(value);
  }

  private _showBackButton = false;

  /** Title string that will be inserted as an h1 */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true }) pageTitle: string;

  /**
   * Async action that occurs when clicking the back button
   *
   * If unset, will call `location.back()`
   **/
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  backAction: FunctionReturningAwaitable = async () => {
    return this.popupRouterCacheService.back();
  };
}
