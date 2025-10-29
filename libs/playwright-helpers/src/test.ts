import { test as base } from "@playwright/test";

import { AuthFixture } from "./fixtures/auth.fixture";
import { UserStateFixture } from "./fixtures/user-state.fixture";

interface TestParams {
  auth: AuthFixture;
  userState: UserStateFixture;
}

export const test = base.extend<TestParams>({
  auth: AuthFixture.fixtureValue(),
});
