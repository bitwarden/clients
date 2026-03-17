export interface ConnectionEntry {
  id: string;
  name: string;
  fingerprint: string;
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
