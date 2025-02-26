export type LegacyMessage = {
  command: string;
  messageId: number;

  userId?: string;
  timestamp?: number;

  publicKey?: string;
};
