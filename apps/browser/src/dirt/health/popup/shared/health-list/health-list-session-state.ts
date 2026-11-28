import { inject, Injectable } from "@angular/core";
import { distinctUntilChanged, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

/**
 * Health list state for the life of the popup. The popup view cache only rehydrates when the
 * popup opens, so a list that is destroyed and rebuilt in the same popup (open an item, come
 * back) would start over without this. Dropped when the active account changes.
 */
@Injectable({ providedIn: "root" })
export class HealthListSessionState {
  private readonly values = new Map<string, unknown>();

  constructor() {
    inject(AccountService)
      .activeAccount$.pipe(
        map((account) => account?.id),
        distinctUntilChanged(),
      )
      .subscribe(() => this.values.clear());
  }

  has(key: string): boolean {
    return this.values.has(key);
  }

  get(key: string): unknown {
    return this.values.get(key);
  }

  set(key: string, value: unknown): void {
    this.values.set(key, value);
  }
}
