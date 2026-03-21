/** Storage keys for agent access state in chrome.storage.local */
export const LISTENING_ENABLED_KEY = "agent_access_listening_enabled";
export const AUDIT_LOG_KEY = "agent_access_audit_log";
export const AUDIT_LOG_MAX_ENTRIES = 200;

export interface CredentialLookupResult {
  credentialId?: string;
  username?: string;
  password?: string;
  totp?: string;
  uri?: string;
  domain?: string;
}

export interface CredentialMatch {
  cipherId: string;
  name: string;
  username: string;
  uri: string;
}

export interface AuditLogEntry {
  connectionId: string;
  connectionName: string;
  timestamp: number;
  action:
    | "credential_approved"
    | "credential_denied"
    | "credential_auto_approved"
    | "connected"
    | "disconnected";
  domain?: string;
  fields?: string[];
}

/** Extract hex from "IdentityFingerprint(hex...)" Debug format, or return as-is. */
export function parseIdentityFingerprint(raw: string): string {
  const match = raw.match(/IdentityFingerprint\(([0-9a-f]+)\)/);
  return match ? match[1] : raw;
}

/** Build a cache key for auto-approval lookup: identity + query uniquely identify a request source. */
export function buildApprovalCacheKey(identityHex: string, query: any): string {
  return `${identityHex}:${JSON.stringify(query)}`;
}

/** Extract a human-readable domain string from a credential query object. */
export function extractDomainFromQuery(
  query: { domain: string } | { id: string } | { search: string },
): string {
  if ("domain" in query) {
    return query.domain;
  }
  if ("search" in query) {
    return query.search;
  }
  return query.id;
}

/** Filter a credential to only include the specified fields (username, password, totp). */
export function filterCredentialByFields(
  credential: CredentialLookupResult,
  fields: Set<string>,
): CredentialLookupResult {
  return {
    credentialId: credential.credentialId,
    username: fields.has("username") ? credential.username : undefined,
    password: fields.has("password") ? credential.password : undefined,
    totp: fields.has("totp") ? credential.totp : undefined,
    uri: credential.uri,
    domain: credential.domain,
  };
}

/** Parameters for recording an auto-approval in the background cache. */
export interface AutoApproveParams {
  identityHex: string;
  query: any;
  cipherId: string;
  fields: string[];
  durationMinutes: number;
}

export interface CredentialRequestData {
  domain: string;
  requestId: string;
  identity: string;
  connectionName: string;
  matches: CredentialMatch[];
  query?: { domain: string } | { id: string } | { search: string };
}
