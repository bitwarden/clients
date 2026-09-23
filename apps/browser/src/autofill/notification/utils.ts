import {
  AtRiskPasswordNotificationParams,
  NotificationBarIframeInitData,
  NotificationTypes,
} from "./abstractions/notification-bar";

/**
 * Narrows `value.type` and `value.params` to the type required for an at-risk
 * password notification while preserving the caller's concrete type.
 *
 * This is a type guard, not a validator. It checks that fields have the correct
 * types but does not validate their values.
 *
 * @returns `true` when `value.type` is `NotificationTypes.AtRiskPassword` and
 * `value.params` is an object of type `AtRiskPasswordNotificationParams`.
 * Returns `false` for any other shape.
 */
export function isAtRiskPasswordNotification<T extends NotificationBarIframeInitData>(
  value: T,
): value is T & {
  type: typeof NotificationTypes.AtRiskPassword;
  params: AtRiskPasswordNotificationParams;
} {
  if (value.type !== NotificationTypes.AtRiskPassword) {
    return false;
  }
  const { params } = value;
  if (params == null || typeof params !== "object") {
    return false;
  }
  const p = params as Record<string, unknown>;
  return (
    typeof p["organizationName"] === "string" && typeof p["hasPasswordChangeUri"] === "boolean"
  );
}
