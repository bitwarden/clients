import { Region } from "../../abstractions/environment.service";
import {
  EnvironmentState,
  EnvironmentUrls,
  GLOBAL_ENVIRONMENT_KEY,
  USER_ENVIRONMENT_KEY,
} from "../../services/default-environment.service";
import { defineManagedOverlay } from "../managed-overlay-registry";

const URL_FIELDS = [
  "base",
  "webVault",
  "api",
  "identity",
  "icons",
  "notifications",
  "events",
] as const;

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

  const urls = new EnvironmentUrls();
  urls.base = read("base");
  urls.webVault = read("webVault");
  urls.api = read("api");
  urls.identity = read("identity");
  urls.icons = read("icons");
  urls.notifications = read("notifications");
  urls.events = read("events");

  const anyPresent = URL_FIELDS.some((f) => read(f) != null);
  if (!anyPresent) {
    return null;
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
