import { Injectable } from "@angular/core";
import { map, Observable, of, catchError, firstValueFrom, switchMap, from } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { RECENT_USERNAMES_KEY } from "./recent-usernames.state";

/**
 * Service to manage recent usernames for autocomplete in login forms.
 * Stores up to 20 recent usernames securely on disk.
 * Data is automatically encrypted/decrypted by the StateProvider layer.
 * Persists across sessions and loads automatically at login.
 */
@Injectable({
  providedIn: "root",
})
export class RecentUsernamesService {
  private readonly MAX_USERNAMES = 20;

  constructor(
    private accountService: AccountService,
    private stateProvider: StateProvider,
    private cipherService: CipherService,
  ) {}

  /**
   * Get recent usernames for active user as an Observable
   * @returns Observable of recent usernames (empty array if not available)
   */
  recentUsernames$(): Observable<string[]> {
    return this.accountService.activeAccount$.pipe(
      switchMap((account) => {
        if (!account?.id) {
          return of([]);
        }
        return from(this.getUsernamesOrSeedFromIdentity(account.id));
      }),
      map((usernames) => usernames ?? []),
      catchError(() => {
        return of([]);
      }),
    );
  }

  /**
   * Get the top N most recent usernames for a user
   * @param userId The user ID
   * @param limit Maximum number of usernames to return (default: 3)
   */
  async getRecent(userId: UserId, limit: number = 3): Promise<string[]> {
    try {
      const usernames = await this.getUsernamesOrSeedFromIdentity(userId);
      return (usernames ?? []).slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * Add a username to the history (LRU: most recent first)
   * Automatically encrypts and saves to disk
   * @param userId The user ID
   * @param username The username to add
   */
  async addUsername(userId: UserId, username: string): Promise<void> {
    if (!username || username.trim() === "") {
      return;
    }

    try {
      const trimmed = username.trim();
      const state = this.stateProvider.getUser(userId, RECENT_USERNAMES_KEY);

      await state.update((current) => {
        const currentUsernames = current ?? [];

        // Remove if already exists (to move it to the top)
        const filtered = currentUsernames.filter((u) => u !== trimmed);

        // Add to top and keep max MAX_USERNAMES
        return [trimmed, ...filtered].slice(0, this.MAX_USERNAMES);
      });
    } catch {
      // Silently fail
    }
  }

  /**
   * Seed recent usernames with the account email on first login when the list is empty.
   * Returns the current list after seeding (or empty if nothing to seed).
   */
  private async getUsernamesOrSeedFromIdentity(userId: UserId): Promise<string[]> {
    const state = this.stateProvider.getUser(userId, RECENT_USERNAMES_KEY);
    const usernames = await firstValueFrom(state.state$);

    if (usernames?.length) {
      return usernames;
    }

    const seededFromIdentity = await this.seedFromIdentityCiphers(userId);

    if (seededFromIdentity.length) {
      const updated = await firstValueFrom(state.state$);
      return updated ?? seededFromIdentity;
    }

    const accounts = await firstValueFrom(this.accountService.accounts$);
    const identityEmail = accounts?.[userId]?.email?.trim();

    if (!identityEmail) {
      return [];
    }

    await this.addUsername(userId, identityEmail);
    return [identityEmail];
  }

  /**
   * Collects usernames and email addresses from identity ciphers to seed the recent usernames list.
   * Runs only when the list is empty to avoid unnecessary processing.
   */
  private async seedFromIdentityCiphers(userId: UserId): Promise<string[]> {
    try {
      const ciphers = await this.cipherService.getAllDecrypted(userId);
      const identityUsernamesAndEmails: string[] = [];

      for (const cipher of ciphers) {
        const email = cipher.identity?.email?.trim();
        if (email) {
          identityUsernamesAndEmails.push(email);
        }

        const username = cipher.identity?.username?.trim();
        if (username) {
          identityUsernamesAndEmails.push(username);
        }
      }

      if (!identityUsernamesAndEmails.length) {
        return [];
      }

      // Build the usernames list in memory to avoid multiple disk writes.
      const usernames: string[] = [];
      for (const value of identityUsernamesAndEmails) {
        const existing = usernames.indexOf(value);
        if (existing !== -1) {
          usernames.splice(existing, 1);
        }
        usernames.unshift(value);
        if (usernames.length > this.MAX_USERNAMES) {
          usernames.pop();
        }
      }

      const state = this.stateProvider.getUser(userId, RECENT_USERNAMES_KEY);
      await state.update(() => usernames);

      return usernames;
    } catch {
      return [];
    }
  }

  /**
   * Clear all history for a user
   * @param userId The user ID
   */
  async clear(userId: UserId): Promise<void> {
    try {
      const state = this.stateProvider.getUser(userId, RECENT_USERNAMES_KEY);
      await state.update(() => []);
    } catch {
      // Silently fail
    }
  }
}
