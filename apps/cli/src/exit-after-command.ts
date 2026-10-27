/**
 * Exits once the command that ran has finished.
 *
 * Services leave timers and sockets behind (e.g. the desktop IPC discovery timeout, RxJS
 * intervals), which keep an idle process alive for seconds after its output is written.
 *
 * Output is flushed first: stdout to a pipe is asynchronous on macOS, so exiting straight away can
 * truncate a large `list` output.
 */
export function exitAfterCommand(): void {
  // An empty write's callback runs once everything written before it has been flushed.
  process.stdout.write("", () => {
    // Without an argument, exit uses process.exitCode, which processResponse sets.
    process.stderr.write("", () => process.exit());
  });
}
