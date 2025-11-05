export abstract class ExtensionUrlTokenService {
  abstract generateToken(): string;

  abstract createTokenUrl(path: string): string;

  abstract validateUrl(url: string): boolean;

  abstract revokeToken(url: string): void;

  abstract extractToken(url: string): string | null;
}
