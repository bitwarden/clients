import { ItemDetail } from "@klappstuhl/ui-bridge";

/**
 * Mock vault data for the redesign preview shell. Shaped as the bridge's
 * ItemDetail view-model so the UI is built against the real contract. Replaced
 * by VaultViewModelService (real CipherService) in the bridge phase.
 */
export const MOCK_ITEMS: ItemDetail[] = [
  {
    id: "1",
    kind: "login",
    title: "GitHub",
    subtitle: "octocat@example.com",
    favorite: true,
    tagIds: ["work"],
    iconKey: "github.com",
    hasTotp: true,
    revisionDate: "2026-06-10T12:00:00Z",
    username: "octocat@example.com",
    password: "h0rse-b4ttery-staple!",
    uris: ["https://github.com/login"],
    totpAvailable: true,
  },
  {
    id: "2",
    kind: "login",
    title: "Proton Mail",
    subtitle: "me@proton.me",
    favorite: true,
    tagIds: ["personal"],
    iconKey: "proton.me",
    hasTotp: false,
    revisionDate: "2026-06-14T09:30:00Z",
    username: "me@proton.me",
    password: "Tr0ub4dour&3xtra",
    uris: ["https://account.proton.me"],
    totpAvailable: false,
  },
  {
    id: "3",
    kind: "card",
    title: "Visa •• 4242",
    subtitle: "Expires 08/29",
    favorite: false,
    tagIds: ["personal"],
    hasTotp: false,
    revisionDate: "2026-05-02T18:00:00Z",
    totpAvailable: false,
  },
  {
    id: "4",
    kind: "identity",
    title: "Personal Identity",
    subtitle: "Jane A. Doe",
    favorite: false,
    tagIds: [],
    hasTotp: false,
    revisionDate: "2026-04-21T11:15:00Z",
    totpAvailable: false,
  },
  {
    id: "5",
    kind: "note",
    title: "Wi-Fi password",
    subtitle: "Home network",
    favorite: false,
    tagIds: ["home"],
    hasTotp: false,
    revisionDate: "2026-06-01T08:00:00Z",
    notes: "SSID: Klappstuhl-5G\nKey: correct-horse-battery",
    totpAvailable: false,
  },
  {
    id: "6",
    kind: "login",
    title: "AWS Console",
    subtitle: "root",
    favorite: false,
    tagIds: ["work"],
    iconKey: "aws.amazon.com",
    hasTotp: true,
    revisionDate: "2026-06-15T16:45:00Z",
    username: "root",
    password: "aws-r00t-do-not-share",
    uris: ["https://console.aws.amazon.com"],
    totpAvailable: true,
  },
];

/** Crude strength heuristic for the preview only (real score comes from core). */
export function mockStrength(password: string | undefined): number {
  if (!password) {
    return 0;
  }
  let score = 0;
  if (password.length >= 8) {
    score++;
  }
  if (password.length >= 14) {
    score++;
  }
  if (/[^A-Za-z0-9]/.test(password)) {
    score++;
  }
  if (/[0-9]/.test(password) && /[A-Za-z]/.test(password)) {
    score++;
  }
  return Math.min(4, score);
}
