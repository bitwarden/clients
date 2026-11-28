import { AutomationCapability } from "../automation-capability";

/** Client-supplied handling of a locked screen, resolving once the client has handled it. */
export type LockScreen = () => Promise<void>;

/** Raises operating system events that the client reacts to. Only wired on clients that react. */
export class SystemEventsCapability extends AutomationCapability {
  readonly automationName = "systemEvents";

  constructor(private lockScreenHandler: LockScreen) {
    super();
  }

  /** Reports a locked screen, e.g. to apply the "On system lock" session timeout. */
  async lockScreen(): Promise<void> {
    await this.lockScreenHandler();
  }
}
