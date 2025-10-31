// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SelectionModel } from "@angular/cdk/collections";
import { Component, EventEmitter, Input, Output } from "@angular/core";

import { AccessTokenView } from "../models/view/access-token.view";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "sm-access-list",
  templateUrl: "./access-list.component.html",
  standalone: false,
})
export class AccessListComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  get tokens(): AccessTokenView[] {
    return this._tokens;
  }
  set tokens(secrets: AccessTokenView[]) {
    this.selection.clear();
    this._tokens = secrets;
  }
  private _tokens: AccessTokenView[];

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() newAccessTokenEvent = new EventEmitter();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() revokeAccessTokensEvent = new EventEmitter<AccessTokenView[]>();

  protected selection = new SelectionModel<string>(true, []);

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.tokens.length;
    return numSelected === numRows;
  }

  toggleAll() {
    this.isAllSelected()
      ? this.selection.clear()
      : this.selection.select(...this.tokens.map((s) => s.id));
  }

  protected revokeSelected() {
    const selected = this.tokens.filter((s) => this.selection.selected.includes(s.id));
    this.revokeAccessTokensEvent.emit(selected);
  }
}
