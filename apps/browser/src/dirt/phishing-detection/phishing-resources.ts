export type PhishingResource = {
  remoteUrl: string;
  checksumUrl: string;
  todayUrl: string;
  name?: string;
};

export const PhishingResourceType = Object.freeze({
  Domains: "domains",
  Links: "links",
} as const);

export type PhishingResourceType = (typeof PhishingResourceType)[keyof typeof PhishingResourceType];

export const PHISHING_RESOURCES: Record<PhishingResourceType, PhishingResource[]> = {
  [PhishingResourceType.Domains]: [
    {
      name: "Phishing.Database Domains",
      remoteUrl:
        "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt",
      checksumUrl:
        "https://raw.githubusercontent.com/Phishing-Database/checksums/refs/heads/master/phishing-domains-ACTIVE.txt.md5",
      todayUrl:
        "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/refs/heads/master/phishing-domains-NEW-today.txt",
    },
  ],
  [PhishingResourceType.Links]: [
    {
      name: "Phishing.Database Links",
      remoteUrl:
        "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-links-ACTIVE.txt",
      checksumUrl:
        "https://raw.githubusercontent.com/Phishing-Database/checksums/refs/heads/master/phishing-links-ACTIVE.txt.md5",
      todayUrl:
        "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/refs/heads/master/phishing-links-NEW-today.txt",
    },
  ],
};

export function getPhishingResources(
  type: PhishingResourceType,
  index = 0,
): PhishingResource | undefined {
  const list = PHISHING_RESOURCES[type] ?? [];
  return list[index];
}
