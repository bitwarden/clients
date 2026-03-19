// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberRegistryEntryView } from "../view/member-registry-entry.view";

/**
 * Serializable data model for a member registry entry
 *
 * Replaces the `MemberRegistryEntryData` interface in `risk-insights-report.data.ts`.
 * The `userName` field is optional: the Bitwarden API may return `""` for members with
 * no display name set — normalization to `undefined` is done at the call site when
 * constructing from external sources.
 *
 * - See {@link MemberRegistryEntryView} for View Model
 */
export class MemberRegistryEntryData {
  id: string = "";
  userName?: string;
  email: string = "";
}
