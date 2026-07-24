import { BehaviorSubject, Observable } from "rxjs";

import { UserId } from "@bitwarden/user-core";

import { UserKey } from "../../types/key";

import { UserKeyStateService } from "./user-key-state.service";

/**
 * Stores user keys in process-local memory. Used in contexts that own the
 * authoritative copy of the user key (web, browser background, desktop main, CLI).
 */
export class DefaultUserKeyStateService implements UserKeyStateService {
  private readonly subjects = new Map<UserId, BehaviorSubject<UserKey | null>>();

  async setUserKey(userId: UserId, key: UserKey | null): Promise<void> {
    this.subject(userId).next(key);
  }

  async getUserKey(userId: UserId): Promise<UserKey | null> {
    return this.subjects.get(userId)?.value ?? null;
  }

  userKey$(userId: UserId): Observable<UserKey | null> {
    return this.subject(userId).asObservable();
  }

  /** The current key (or null) of every user that has ever been set in this context. */
  protected entries(): [UserId, UserKey | null][] {
    return Array.from(this.subjects, ([userId, subject]) => [userId, subject.value]);
  }

  private subject(userId: UserId): BehaviorSubject<UserKey | null> {
    let subject = this.subjects.get(userId);
    if (subject == null) {
      subject = new BehaviorSubject<UserKey | null>(null);
      this.subjects.set(userId, subject);
    }
    return subject;
  }
}
