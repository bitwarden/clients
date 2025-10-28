// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, EventEmitter, Input, Output } from "@angular/core";

import { CipherStatus } from "../models/cipher-status.model";
import { VaultFilter } from "../models/vault-filter.model";

@Directive()
export class StatusFilterComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() hideFavorites = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() hideTrash = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() hideArchive = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onFilterChange: EventEmitter<VaultFilter> = new EventEmitter<VaultFilter>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() activeFilter: VaultFilter;

  get show() {
    return !(this.hideFavorites && this.hideTrash && this.hideArchive);
  }

  applyFilter(cipherStatus: CipherStatus) {
    this.activeFilter.resetFilter();
    this.activeFilter.status = cipherStatus;
    this.onFilterChange.emit(this.activeFilter);
  }
}
