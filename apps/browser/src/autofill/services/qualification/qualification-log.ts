/**
 * Console output for the qualification layer, on development builds only.
 *
 * `LogService` is unreachable from content scripts — see `content/performance.ts`
 * — so qualification diagnostics go to the console directly. Routing every one
 * of them through this module keeps the `no-console` suppression to a single
 * site and the `[QualificationEngine]` prefix identical everywhere.
 *
 * Every function here is gated on `process.env.ENV` rather than a runtime
 * toggle, so DefinePlugin folds the branch away in production. Per
 * `content/performance.design.md`, a runtime switch would be a side channel a
 * host page could use to observe which classifier is running against its DOM;
 * a build-time gate leaves no variable for anyone to flip.
 */
const PREFIX = "[QualificationEngine]";

export function devBuild(): boolean {
  return process.env.ENV === "development";
}

export function info(message: string): void {
  if (!devBuild()) {
    return;
  }
  // eslint-disable-next-line no-console
  console.info(`${PREFIX} ${message}`);
}

export function warn(message: string): void {
  if (!devBuild()) {
    return;
  }
  // eslint-disable-next-line no-console
  console.warn(`${PREFIX} ${message}`);
}

/**
 * Emits `lines` under a collapsed group headed by `title`. Falls back to plain
 * logging where `console.group` is unavailable, which is the case in some
 * content-script sandboxes and in the jsdom test environment.
 */
export function group(title: string, lines: ReadonlyArray<string>): void {
  if (!devBuild()) {
    return;
  }

  /* eslint-disable no-console */
  if (typeof console.groupCollapsed !== "function" || typeof console.groupEnd !== "function") {
    console.info(`${PREFIX} ${title}`);
    for (const line of lines) {
      console.info(`${PREFIX}   ${line}`);
    }
    return;
  }

  console.groupCollapsed(`${PREFIX} ${title}`);
  for (const line of lines) {
    console.info(line);
  }
  console.groupEnd();
  /* eslint-enable no-console */
}
