/**
 * Internal interface for member data from the API.
 * Represents a simplified view of organization user details relevant for access reporting.
 */
export interface MemberData {
  /** User identifier */
  id: string;
  /** User's display name (may be empty) */
  name: string;
  /** User's email address */
  email: string;
  /** Whether two-factor authentication is enabled */
  twoFactorEnabled: boolean;
  /** Whether account recovery (reset password) is enrolled */
  resetPasswordEnrolled: boolean;
  /** Whether the user uses Key Connector */
  usesKeyConnector: boolean;
  /** Array of group IDs the user belongs to */
  groups: string[];
  /** Avatar color for UI display */
  avatarColor: string | null;
}
