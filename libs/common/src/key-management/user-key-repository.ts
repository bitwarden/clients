import { Repository, UserKeyState } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { SymmetricCryptoKey } from "../platform/models/domain/symmetric-crypto-key";
import { UserKey } from "../types/key";

import { UserKeyStateService } from "./user-key-state";

/**
 * SDK repository for the user key, backed by {@link UserKeyStateService}.
 * A user has at most one user key, so record ids are ignored.
 */
export class UserKeyRepository implements Repository<UserKeyState> {
  constructor(
    private userId: UserId,
    private userKeyStateService: UserKeyStateService,
  ) {}

  async get(_id: string): Promise<UserKeyState | null> {
    const key = await this.userKeyStateService.getUserKey(this.userId);
    return key == null ? null : { decrypted_user_key: key.toBase64() };
  }

  async list(): Promise<UserKeyState[]> {
    const value = await this.get("");
    return value == null ? [] : [value];
  }

  async set(_id: string, value: UserKeyState): Promise<void> {
    await this.userKeyStateService.setUserKey(
      this.userId,
      SymmetricCryptoKey.fromString(value.decrypted_user_key) as UserKey,
    );
  }

  async setBulk(values: [string, UserKeyState][]): Promise<void> {
    for (const [id, value] of values) {
      await this.set(id, value);
    }
  }

  async remove(_id: string): Promise<void> {
    await this.userKeyStateService.setUserKey(this.userId, null);
  }

  async removeBulk(_keys: string[]): Promise<void> {
    await this.remove("");
  }

  async removeAll(): Promise<void> {
    await this.remove("");
  }
}
