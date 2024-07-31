export type LegacyMessage = {
  command: string;

  userId?: string;
  timestamp?: number;

  publicKey?: string;
  userKeyB64?: string;
};
