// @TODO Refactor
export const QRCodeOptions = {
  WiFi: "wifi",
  URL: "url",
  PlainText: "plaintext",
} as const;

export type QRCodeOption = (typeof QRCodeOptions)[keyof typeof QRCodeOptions] | null;
