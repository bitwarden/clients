/**
 * One named surface on the {@link AutomationDriver}, and the multi-provider token that collects
 * them. Implementations may live in any library — the driver never imports them.
 *
 * ```ts
 * safeProvider({
 *   provide: AutomationCapability,
 *   useFactory: (messagingService: MessagingService) =>
 *     new DesktopNavigationCapability(messagingService),
 *   deps: [MessagingService],
 *   multi: true,
 * });
 * ```
 */
export abstract class AutomationCapability {
  /** Key the capability is looked up by, e.g. `driver.get("lock")`. Must be unique. */
  abstract readonly automationName: string;
}
