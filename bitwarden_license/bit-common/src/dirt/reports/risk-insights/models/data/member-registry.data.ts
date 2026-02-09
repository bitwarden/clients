/**
 * Compact storage for unique member information.
 * Used to deduplicate member details across multiple application reports.
 *
 * Instead of storing full member objects in every application:
 * - Store member info once in the registry
 * - Reference members by ID in each application
 *
 * @example
 * ```typescript
 * const registry: MemberRegistry = {
 *   "user-123": { email: "user@example.com", userName: "User 1" },
 *   "user-456": { email: "admin@example.com", userName: "Admin" }
 * };
 *
 * // In report: memberIds: ["user-123", "user-456"]
 * // Instead of: memberDetails: [{ userGuid: "user-123", email: "...", ... }, ...]
 * ```
 */
export interface MemberRegistryEntry {
  /**
   * Member's email address
   */
  email: string;

  /**
   * Member's display name (optional)
   */
  userName?: string | null;
}

/**
 * Registry mapping member IDs to their information.
 * Key: User GUID
 * Value: Member information (email, userName)
 */
export type MemberRegistry = Record<string, MemberRegistryEntry>;
