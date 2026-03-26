export interface CreateReceiveRequest {
  name: string;
  scekWrappedPublicKey: string;
  userKeyWrappedSharedContentEncryptionKey: string;
  userKeyWrappedPrivateKey: string;
  expirationDate: string;
}
