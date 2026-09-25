/** Records every test instead of only failing ones, e.g. `E2E_VIDEO=1`. */
const RECORD_ALL = process.env.E2E_VIDEO != null;

/**
 * Directory for contexts the suites launch themselves, which Playwright's `video` option
 * doesn't reach, e.g. a persistent context or Electron. Undefined when not recording.
 */
export function videoDir(outputDir: string): string | undefined {
  return RECORD_ALL ? outputDir : undefined;
}

/** Playwright's `video` option for the contexts it creates itself. */
export const VIDEO_MODE = RECORD_ALL ? "on" : "retain-on-failure";
