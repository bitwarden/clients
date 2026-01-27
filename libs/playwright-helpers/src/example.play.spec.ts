import { expectUnlockedAs } from "./expect/auth";

import { test } from "./";

test.skip("login and save session", async ({ auth }) => {
  const { page, scene } = await auth.authenticate("test@example.com", "asdfasdfasdf");

  await expectUnlockedAs(scene.mangle("test@example.com"), page);
});

test.skip("As long as the previous test ran in this worker, this time it will reuse authentication", async ({
  auth,
}) => {
  const { page, scene } = await auth.authenticate("test@example.com", "asdfasdfasdf");

  await expectUnlockedAs(scene.mangle("test@example.com"), page);
});
