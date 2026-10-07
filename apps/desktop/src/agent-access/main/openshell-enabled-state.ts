/**
 * Whether the Agent Access OpenShell toggle is actually on (the listener started), shared between
 * the service that applies the toggle and the management gate (§M8.20 rule 6). One instance is
 * constructed in `main.ts` and passed to both.
 */
export class OpenShellEnabledState {
  private enabled = false;

  isEnabled(): boolean {
    return this.enabled;
  }

  set(enabled: boolean): void {
    this.enabled = enabled;
  }
}
