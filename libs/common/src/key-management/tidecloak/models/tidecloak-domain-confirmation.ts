/**
 * Data required for TideCloak domain confirmation UI.
 */
export interface TideCloakDomainConfirmation {
  /** The TideCloak service URL to display for confirmation */
  tideCloakUrl: string;
  /** The organization SSO identifier for fetching organization details */
  organizationSsoIdentifier: string;
}
