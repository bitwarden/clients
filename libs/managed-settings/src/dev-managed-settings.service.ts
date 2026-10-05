import { createManagementProfile } from "./create-management-profile";
import { DefaultManagedSettingsService } from "./default-managed-settings.service";

/**
 * A {@link ManagedSettingsService} whose profile comes from a developer rather than from the host
 * operating system's Unified Endpoint Management (UEM/MDM) channel.
 *
 * Acquiring a real profile means an administrator-installed policy on Chrome, a native managed
 * manifest on Firefox, and nothing at all on web, desktop, and the CLI. This implementation lets a
 * developer exercise a managed setting without any of that. The source is normalized exactly as a
 * host profile would be, so a consumer cannot tell the two apart.
 *
 * Only a DI container provides this, and only behind the `managedSettingsDevSource` dev flag, which
 * `devFlagEnabled` hard-gates on a development build. It is never reachable in a released client.
 *
 * {@link updateProfile} is deliberately not overridden, so a host push still wins. A client that
 * also runs host acquisition must skip it while this implementation is in use, or the host's empty
 * profile will clear the developer's on the next read.
 */
export class DevManagedSettingsService extends DefaultManagedSettingsService {
  /**
   * Replace the active profile with one built from a nested settings object, for example
   * `{ environment: { base: "https://localhost:8080" } }`.
   */
  pushExplicit(source: Record<string, unknown>): void {
    this.updateProfile(createManagementProfile(source));
  }
}
