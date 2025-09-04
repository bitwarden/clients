export const PhishingDetectionMessage = Object.freeze({
  Close: "phishing-detection-close",
  Continue: "phishing-detection-continue",
} as const);

export type PhishingDetectionMessageTypes =
  (typeof PhishingDetectionMessage)[keyof typeof PhishingDetectionMessage];

export function isPhishingDetectionMessage(
  input: unknown,
): input is { command: PhishingDetectionMessageTypes } {
  if (!!input && typeof input === "object" && "command" in input) {
    const command = (input as Record<string, unknown>)["command"];
    if (typeof command === "string") {
      return Object.values(PhishingDetectionMessage).includes(
        command as PhishingDetectionMessageTypes,
      );
    }
  }
  return false;
}

export type PhishingDetectionTabId = number;

export type CaughtPhishingDomain = {
  url: URL;
  warningPageUrl: URL;
  requestedContinue: boolean;
};
