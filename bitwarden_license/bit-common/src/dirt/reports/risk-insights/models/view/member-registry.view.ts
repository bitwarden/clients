import { Jsonify } from "type-fest";

import { View } from "@bitwarden/common/models/view/view";

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
 * Stores organization members once and provides O(1) lookup by user ID.
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
 * const registry = new MemberRegistry();
 * registry.add({ id: "abc-123", userName: "Alice", email: "alice@example.com" });
 * registry.add({ id: "def-456", userName: "Bob", email: "bob@example.com" });
 *
 * // O(1) lookup
 * const alice = registry.get("abc-123");
 *
 * // Get all members
 * const allMembers = registry.getAll();
 *
 * // Check size
 * console.log(registry.size()); // 2
 * ```
 */
export class MemberRegistry implements View {
  /**
   * Internal storage: Map from organization user ID to member entry
   */
  private entries: Map<string, MemberRegistryEntry>;

  constructor(entries?: Map<string, MemberRegistryEntry>) {
    this.entries = entries ?? new Map();
  }

  /**
   * Add a member to the registry
   *
   * If a member with the same ID already exists, it will be replaced.
   *
   * @param entry - The member entry to add
   */
  add(entry: MemberRegistryEntry): void {
    this.entries.set(entry.id, entry);
  }

  /**
   * Get a member from the registry by ID
   *
   * @param id - Organization user ID
   * @returns Member entry if found, undefined otherwise
   */
  get(id: string): MemberRegistryEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Get all members in the registry
   *
   * @returns Array of all member entries
   */
  getAll(): MemberRegistryEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Get the number of members in the registry
   *
   * @returns Count of members
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Check if a member exists in the registry
   *
   * @param id - Organization user ID
   * @returns True if member exists, false otherwise
   */
  has(id: string): boolean {
    return this.entries.has(id);
  }

  /**
   * Remove a member from the registry
   *
   * @param id - Organization user ID
   * @returns True if member was removed, false if not found
   */
  delete(id: string): boolean {
    return this.entries.delete(id);
  }

  /**
   * Clear all members from the registry
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Get all member IDs in the registry
   *
   * @returns Array of organization user IDs
   */
  getIds(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Serialize the registry to JSON
   */
  toJSON() {
    return {
      entries: Array.from(this.entries.entries()).map(([id, entry]) => ({
        id,
        userName: entry.userName,
        email: entry.email,
      })),
    };
  }

  /**
   * Deserialize the registry from JSON
   */
  static fromJSON(obj: Partial<Jsonify<MemberRegistry>> | undefined): MemberRegistry {
    if (obj == null || !obj.entries) {
      return new MemberRegistry();
    }

    const entries = new Map<string, MemberRegistryEntry>();
    obj.entries.forEach((entry: any) => {
      entries.set(entry.id, {
        id: entry.id,
        userName: entry.userName,
        email: entry.email,
      });
    });

    return new MemberRegistry(entries);
  }
}
