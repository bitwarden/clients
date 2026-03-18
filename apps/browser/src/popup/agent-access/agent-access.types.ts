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
  sessionId: string;
  connectionName: string;
  matches: CredentialMatch[];
  query?: { domain: string } | { id: string } | { search: string };
}
