export const QRCodeOptions = {
  WiFi: "wifi",
  Contact: "contact",
  URL: "url",
} as const;

export type QRCodeOption = (typeof QRCodeOptions)[keyof typeof QRCodeOptions] | null;
