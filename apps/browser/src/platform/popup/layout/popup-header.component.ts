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

@Component({
  selector: "popup-header",
  templateUrl: "popup-header.component.html",
  standalone: true,
  imports: [TypographyModule, CommonModule, IconButtonModule, JslibModule, AsyncActionsModule],
})
export class PopupHeaderComponent {
  private popupRouterCacheService = inject(PopupRouterCacheService);
  protected pageContentScrolled: Signal<boolean> = inject(PopupPageComponent).isScrolled;

  /** Background color */
  @Input()
  background: "default" | "alt" = "default";

  /** Display the back button, which uses Location.back() to go back one page in history */
  @Input()
  get showBackButton() {
    return this._showBackButton;
  }
  set showBackButton(value: BooleanInput) {
    this._showBackButton = coerceBooleanProperty(value);
  }

  private _showBackButton = false;

  /** Title string that will be inserted as an h1 */
  @Input({ required: true }) pageTitle: string;

  /**
   * Async action that occurs when clicking the back button
   *
   * If unset, will call `location.back()`
   **/
  @Input()
  backAction: FunctionReturningAwaitable = async () => {
    return this.popupRouterCacheService.back();
  };
}
