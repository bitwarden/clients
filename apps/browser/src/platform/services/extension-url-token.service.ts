import { ExtensionUrlTokenService as ExtensionUrlTokenServiceAbstraction } from "./abstractions/extension-url-token.service";

export class ExtensionUrlTokenService implements ExtensionUrlTokenServiceAbstraction {
  private validTokens = new Set<string>();

  generateToken(): string {
    const token = crypto.randomUUID();
    this.validTokens.add(token);
    return token;
  }

  createTokenUrl(path: string): string {
    const token = this.generateToken();
    const baseUrl = chrome.runtime.getURL(path);
    const url = new URL(baseUrl);
    url.searchParams.set("token", token);
    return url.toString();
  }

  validateUrl(url: string): boolean {
    const token = this.extractToken(url);
    return token !== null && this.validTokens.has(token);
  }

  revokeToken(url: string): void {
    const token = this.extractToken(url);
    if (token) {
      this.validTokens.delete(token);
    }
  }

  extractToken(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get("token");
    } catch {
      return null;
    }
  }
}
