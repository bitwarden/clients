/** Records every test instead of only failing ones, e.g. `E2E_VIDEO=1`. */
const RECORD_ALL = process.env.E2E_VIDEO != null;

export function videoDir(outputDir: string): string | undefined {
  return RECORD_ALL ? outputDir : undefined;
}

/** Playwright's `video` option for the contexts it creates itself. */
export const VIDEO_MODE = RECORD_ALL ? "on" : "retain-on-failure";
