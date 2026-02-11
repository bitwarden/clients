/**
 * Member registry entry
 *
 * Represents a single organization member in the deduplicated member registry.
 * Members are stored once in the registry and referenced by ID from applications.
 *
 * This eliminates the need to duplicate full member objects across every application
 * they have access to, reducing report size by ~80% for large organizations.
 */
export interface MemberRegistryEntry {
  /**
   * Organization user ID (userGuid from OrganizationUserView)
   */
  id: string;

  /**
   * Display name of the member
   */
  userName: string;

  /**
   * Email address of the member
   */
  email: string;
}

/**
 * Member Registry - Deduplicated member lookup table
 *
 * A simple Record mapping organization user ID to member entry.
 * Applications store only member IDs (as Record<string, boolean>) which are
 * resolved to full entries via this registry.
 *
 * **Performance Impact:**
 * - Without registry: 5,000 members × 50 apps × 180 bytes = ~45MB (duplicated)
 * - With registry: 5,000 members × 140 bytes = ~700KB (deduplicated)
 * - **Savings: ~98% reduction in member data storage**
 *
 * @example
 * ```typescript
 * const registry: MemberRegistry = {
 *   "abc-123": { id: "abc-123", userName: "Alice", email: "alice@example.com" },
 *   "def-456": { id: "def-456", userName: "Bob", email: "bob@example.com" }
 * };
 *
 * // O(1) lookup
 * const alice = registry["abc-123"];
 *
 * // Get all members
 * const allMembers = Object.values(registry);
 *
 * // Check size
 * console.log(Object.keys(registry).length); // 2
 *
 * // Check if member exists
 * if ("abc-123" in registry) {
 *   // member exists
 * }
 * ```
 */
export type MemberRegistry = Record<string, MemberRegistryEntry>;
