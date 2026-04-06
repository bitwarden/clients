export class InsecureUrlNotAllowedError extends Error {
  constructor(url?: string) {
    if (url === undefined) {
      super("Insecure URL not allowed. All URLs must use HTTPS.");
    } else {
      super(`Insecure URL not allowed: ${url}. All URLs must use HTTPS.`);
    }
  }
}
