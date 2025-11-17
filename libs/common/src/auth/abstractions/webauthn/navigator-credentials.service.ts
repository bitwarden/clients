export abstract class NavigatorCredentialsService {
  abstract get(options: CredentialRequestOptions): Promise<Credential | null>;
  abstract available(): Promise<boolean>;
}
