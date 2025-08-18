export const PhishingDetectionMessage = Object.freeze({
  Close: "phishing-detection-close",
  Continue: "phishing-detection-continue",
} as const);

export type PhishingDetectionMessage =
  (typeof PhishingDetectionMessage)[keyof typeof PhishingDetectionMessage];

export type PhishingDetectionTabId = number;

export type CaughtPhishingDomain = {
  url: URL;
  warningPageUrl: URL;
  requestedContinue: boolean;
};
