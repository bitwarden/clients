import { test as biometricsTest } from "../desktop/biometrics";
import { FeatureFlag } from "../feature-flags";

import { Cli } from "./cli";

/**
 * The CLI next to the desktop app, with fake desktop biometrics.
 *
 * The desktop fixtures are lazy, so a test that asks only for `cli` never launches the app —
 * which is how "the desktop app is not running" is tested.
 */
export const test = biometricsTest.extend<{
  /** Feature flags overridden to on in the CLI's profile. */
  cliFlags: FeatureFlag[];
  cli: Cli;
}>({
  cliFlags: [[], { option: true }],
  cli: async ({ cliFlags }, use) => {
    const cli = new Cli(cliFlags);
    cli.reset();

    await use(cli);
  },
});

export { expect } from "@playwright/test";
