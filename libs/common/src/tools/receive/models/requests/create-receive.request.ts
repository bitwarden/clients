export class CreateReceiveRequest {
  name: string;
  scekWrappedPublicKey: string;
  userKeyWrappedSharedContentEncryptionKey: string;
  userKeyWrappedPrivateKey: string;
  expirationDate: string;
}
