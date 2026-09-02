import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Interface for a capability that can be used by the automation driver. Capabilities are
 * registered with the driver by providing them to the `AUTOMATION_CAPABILITY` multi-provider
 * token.
 */
export interface AutomationCapability {
  /** Key the capability is looked up by, e.g. `driver.get("lock")`. Must be unique. */
  readonly automationName: string;
}

/**
 * Multi-provider token collecting every capability the running client supports.
 *
 * ```ts
 * safeProvider({
 *   provide: AUTOMATION_CAPABILITY,
 *   useFactory: (messagingService: MessagingService) =>
 *     new DesktopNavigationCapability(messagingService),
 *   deps: [MessagingService],
 *   multi: true,
 * });
 * ```
 */
export const AUTOMATION_CAPABILITY = new SafeInjectionToken<AutomationCapability[]>(
  "AUTOMATION_CAPABILITY",
);
