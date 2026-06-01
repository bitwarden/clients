// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SelectionModel } from "@angular/cdk/collections";
import { Component, EventEmitter, Input, Output } from "@angular/core";

import { TableDataSource } from "@bitwarden/components";

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
    this.dataSource.data = secrets;
  }
  private _tokens: AccessTokenView[];

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() newAccessTokenEvent = new EventEmitter();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() revokeAccessTokensEvent = new EventEmitter<AccessTokenView[]>();

  protected selection = new SelectionModel<string>(true, []);
  protected dataSource = new TableDataSource<AccessTokenView>();

  private readonly EXPIRING_SOON_DAYS = 7;

  protected getTokenStatus(token: AccessTokenView): "expired" | "expiringSoon" | "active" {
    if (token.expireAt == null) {
      return "active";
    }
    const now = new Date();
    if (token.expireAt < now) {
      return "expired";
    }
    if (token.expireAt < new Date(now.getTime() + this.EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000)) {
      return "expiringSoon";
    }
    return "active";
  }

  protected sortByStatus = (a: AccessTokenView, b: AccessTokenView): number => {
    const order = { active: 0, expiringSoon: 1, expired: 2 };
    return order[this.getTokenStatus(a)] - order[this.getTokenStatus(b)];
  };

  protected sortByExpireAt = (a: AccessTokenView, b: AccessTokenView): number => {
    if (a.expireAt == null && b.expireAt == null) {
      return 0;
    }
    if (a.expireAt == null) {
      return 1;
    }
    if (b.expireAt == null) {
      return -1;
    }
    return a.expireAt.getTime() - b.expireAt.getTime();
  };

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.filteredData?.length ?? 0;
    return numSelected === numRows;
  }

  toggleAll() {
    this.isAllSelected()
      ? this.selection.clear()
      : this.selection.select(...(this.dataSource.filteredData ?? []).map((s) => s.id));
  }

  protected revokeSelected() {
    const selected = this._tokens.filter((s) => this.selection.selected.includes(s.id));
    this.revokeAccessTokensEvent.emit(selected);
  }
}
