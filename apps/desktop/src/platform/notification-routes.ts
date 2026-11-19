/**
 * The in-app routes a system notification may open when clicked. Checked in the main process
 * before a notification is shown and again in the renderer before it navigates, so nothing but
 * these pages is reachable from a notification. Matches the whole route: no query, fragment or
 * extra segments.
 */
const ALLOWED_NOTIFICATION_ROUTES: readonly RegExp[] = [
  /^\/pam\/(approvals|my-requests|history)$/,
  /^\/pam\/requests\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
];

export function isAllowedNotificationRoute(route: unknown): route is string {
  return typeof route === "string" && ALLOWED_NOTIFICATION_ROUTES.some((p) => p.test(route));
}
