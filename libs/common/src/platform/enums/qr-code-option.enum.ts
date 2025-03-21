// @TODO Refactor
export const QRCodeOptions = {
  WiFi: "wifi",
  Contact: "contact",
  URL: "url",
  PlainText: "plaintext",
} as const;

export type QRCodeOption = (typeof QRCodeOptions)[keyof typeof QRCodeOptions] | null;
