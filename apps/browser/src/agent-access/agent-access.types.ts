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
  action: "credential_approved" | "credential_denied" | "connected" | "disconnected";
  domain?: string;
  fields?: string[];
}

/** Extract hex from "IdentityFingerprint(hex...)" Debug format, or return as-is. */
export function parseIdentityFingerprint(raw: string): string {
  const match = raw.match(/IdentityFingerprint\(([0-9a-f]+)\)/);
  return match ? match[1] : raw;
}

export interface CredentialRequestData {
  domain: string;
  requestId: string;
  identity: string;
  connectionName: string;
  matches: CredentialMatch[];
  query?: { domain: string } | { id: string } | { search: string };
}
