import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";

import { UriMatchStrategy } from "../../models/domain/domain-service";
import { CipherType } from "../enums/cipher-type";
import { CipherView } from "../models/view/cipher.view";
import { LoginUriView } from "../models/view/login-uri.view";
import { LoginView } from "../models/view/login.view";

import { SearchService } from "./search.service";

const SAMPLE_SERVICES = [
  "Facebook",
  "GitHub",
  "Gmail",
  "Twitter",
  "LinkedIn",
  "Reddit",
  "Amazon",
  "Netflix",
  "Spotify",
  "Discord",
  "Slack",
  "Dropbox",
  "PayPal",
  "eBay",
  "Stripe",
  "Shopify",
  "WordPress",
  "Tumblr",
  "Pinterest",
  "Instagram",
  "TikTok",
  "YouTube",
  "Twitch",
  "Steam",
];

function makeUuid(i: number): string {
  const hex = i.toString(16).padStart(12, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-0000-0000-000000000000`;
}

function buildCipher(i: number): CipherView {
  const cipher = new CipherView();
  cipher.id = makeUuid(i);
  cipher.type = CipherType.Login;
  const service = SAMPLE_SERVICES[i % SAMPLE_SERVICES.length];
  cipher.name = `${service} Account #${i}`;

  const login = new LoginView();
  login.username = `user${i}@example.com`;
  login.password = "irrelevant";
  const uri = new LoginUriView();
  uri.uri = `https://${service.toLowerCase()}.com/login`;
  uri.match = UriMatchStrategy.Domain;
  login.uris = [uri];
  cipher.login = login;
  cipher.notes = `Account note for ${service} #${i}. ${"Lorem ipsum ".repeat(20)}`;

  return cipher;
}

async function measure(
  label: string,
  count: number,
  fn: () => Promise<unknown>,
): Promise<{ median: number; max: number }> {
  const runs = 5;
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(runs / 2)];
  const max = times[times.length - 1];
  // eslint-disable-next-line no-console
  console.log(`[perf][n=${count}] ${label}: median=${median.toFixed(2)}ms max=${max.toFixed(2)}ms`);
  return { median, max };
}

describe("SearchService perf", () => {
  const userId = "user-id" as UserId;
  let service: SearchService;

  beforeAll(() => {
    const mockLogService = {
      error: jest.fn(),
      info: jest.fn(),
      measure: jest.fn(),
    };
    const mockI18nService = {
      locale$: new BehaviorSubject<string>("en").asObservable(),
    };
    service = new SearchService(
      mockLogService as unknown as LogService,
      mockI18nService as unknown as I18nService,
    );
  });

  describe.each([100, 1000, 5000, 10000])("with %i ciphers", (n: number) => {
    let ciphers: CipherView[];

    beforeAll(() => {
      ciphers = Array.from({ length: n }, (_, i) => buildCipher(i));
    });

    it("basic search for 'facebook' is fast", async () => {
      const { median } = await measure("basic 'facebook'", n, () =>
        service.searchCiphers(userId, null, "facebook", ciphers),
      );
      expect(median).toBeLessThan(2000);
    });

    it("basic search for short prefix 'fa'", async () => {
      await measure("basic 'fa'", n, () => service.searchCiphers(userId, null, "fa", ciphers));
    });

    it("basic search for non-matching query", async () => {
      await measure("basic 'zzznoresult'", n, () =>
        service.searchCiphers(userId, null, "zzznoresult", ciphers),
      );
    });
  });
});
