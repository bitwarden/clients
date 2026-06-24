import { Region } from "../../abstractions/environment.service";
import {
  EnvironmentState,
  EnvironmentUrls,
  GLOBAL_ENVIRONMENT_KEY,
  USER_ENVIRONMENT_KEY,
} from "../../services/default-environment.service";
import { defineManagedOverlay } from "../managed-overlay-registry";

/**
 * Build a self-hosted EnvironmentState from the `environment.*` managed leaves,
 * or null when no environment key is managed. A malformed leaf is treated as
 * absent rather than thrown, so a bad admin value cannot break a read.
 */
export function environmentCoerce(
  get: (key: string) => string | undefined,
): EnvironmentState | null {
  const read = (field: string): string | null => {
    const raw = get(`environment.${field}`);
    if (raw == null) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === "string" ? parsed : null;
    } catch {
      return null;
    }
  };

  const base = read("base");
  const webVault = read("webVault");
  const api = read("api");
  const identity = read("identity");
  const icons = read("icons");
  const notifications = read("notifications");
  const events = read("events");

  if (
    base == null &&
    webVault == null &&
    api == null &&
    identity == null &&
    icons == null &&
    notifications == null &&
    events == null
  ) {
    return null;
  }

  const urls = new EnvironmentUrls();
  if (base != null) {
    urls.base = base;
  }
  if (webVault != null) {
    urls.webVault = webVault;
  }
  if (api != null) {
    urls.api = api;
  }
  if (identity != null) {
    urls.identity = identity;
  }
  if (icons != null) {
    urls.icons = icons;
  }
  if (notifications != null) {
    urls.notifications = notifications;
  }
  if (events != null) {
    urls.events = events;
  }

  const state = new EnvironmentState();
  state.region = Region.SelfHosted;
  state.urls = urls;
  return state;
}

/** Register the environment overlay against the global and per-user keys. Idempotent. */
export function registerEnvironmentOverlay(): void {
  defineManagedOverlay({ keyDefinition: GLOBAL_ENVIRONMENT_KEY, coerce: environmentCoerce });
  defineManagedOverlay({ keyDefinition: USER_ENVIRONMENT_KEY, coerce: environmentCoerce });
}
