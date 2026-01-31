import { Page, TestFixture } from "@playwright/test";

import { UserKeyDefinition } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

/** Fixture to provide direct access to User state */
export class UserStateFixture {
  /** Creates a fixture method for {@link UserStateFixture} to extend playwright tests */
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  static fixtureValue(): TestFixture<UserStateFixture, {}> {
    // eslint-disable-next-line no-empty-pattern
    return async ({}, use) => {
      const userState = new UserStateFixture();
      await use(userState);
    };
  }

  /** Gets a value from user state */
  async get<T>(page: Page, userId: UserId, keyDefinition: UserKeyDefinition<T>): Promise<T | null> {
    let json: string | null;
    switch (keyDefinition.stateDefinition.defaultStorageLocation) {
      case "disk":
        json = await page.evaluate(({ key }) => localStorage.getItem(key), {
          key: keyDefinition.buildKey(userId),
        });
        break;
      case "memory":
        json = await page.evaluate(({ key }) => sessionStorage.getItem(key), {
          key: keyDefinition.buildKey(userId),
        });
        break;
      default:
        throw new Error(
          `Unsupported storage location ${keyDefinition.stateDefinition.defaultStorageLocation}`,
        );
    }
    return json == null ? null : (JSON.parse(json) as T);
  }

  /** Sets a value to user state */
  async set<T>(
    page: Page,
    userId: UserId,
    keyDefinition: UserKeyDefinition<T>,
    value: T | null,
  ): Promise<void> {
    switch (keyDefinition.stateDefinition.defaultStorageLocation) {
      case "disk":
        await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
          key: keyDefinition.buildKey(userId),
          value,
        });
        return;
      case "memory":
        await page.evaluate(
          ({ key, value }) => sessionStorage.setItem(key, JSON.stringify(value)),
          { key: keyDefinition.buildKey(userId), value },
        );
        return;
      default:
        throw new Error(
          `Unsupported storage location ${keyDefinition.stateDefinition.defaultStorageLocation}`,
        );
    }
  }
}
