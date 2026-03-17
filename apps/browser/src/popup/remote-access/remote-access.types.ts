export interface ConnectionEntry {
  id: string; // hex of remote IdentityFingerprint — stable per device
  name: string;
  fingerprint: string; // 6-char handshake fingerprint — for display only
  lastUsed: number;
  sessionData: string;
}

export interface CredentialMatch {
  cipherId: string;
  name: string;
  username: string;
  uri: string;
}

export interface CredentialRequestData {
  domain: string;
  requestId: string;
  sessionId: string;
  connectionName: string;
  matches: CredentialMatch[];
}
