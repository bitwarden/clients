import {
  BehaviorSubject,
  ReplaySubject,
  Subject,
  combineLatest,
  concatMap,
  filter,
  firstValueFrom,
  map,
  shareReplay,
} from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";

import { UriMatchStrategy } from "../../models/domain/domain-service";
import { CipherType } from "../enums/cipher-type";
import { CipherView } from "../models/view/cipher.view";
import { LoginUriView } from "../models/view/login-uri.view";
import { LoginView } from "../models/view/login.view";

import { SearchService } from "./search.service";

/**
 * Reproduces the user-visible symptom of bitwarden/clients vault search lagging
 * after first login on desktop. The actual `SearchService` is fast (see
 * search.service.perf.spec.ts) but the vault.component composes it downstream
 * of `cipherListViews$`, which only first-emits once SDK decryption completes.
 *
 * In this test we mirror that exact composition with a synthetic
 * `cipherListViews$` whose first emission is delayed by 3000ms (mimicking a
 * cold SDK decrypt of a large vault). We measure how long the user waits
 * between typing in the search input and seeing filtered results.
 */

const FAKE_DECRYPT_DELAY_MS = 3_000;
const N_CIPHERS = 1500;

function makeUuid(i: number): string {
  const hex = i.toString(16).padStart(12, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-0000-0000-000000000000`;
}

function buildCipher(i: number): CipherView {
  const cipher = new CipherView();
  cipher.id = makeUuid(i);
  cipher.type = CipherType.Login;
  const services = ["Facebook", "GitHub", "Gmail", "Twitter", "LinkedIn"];
  const service = services[i % services.length];
  cipher.name = `${service} Account #${i}`;
  const login = new LoginView();
  login.username = `user${i}@example.com`;
  const uri = new LoginUriView();
  uri.uri = `https://${service.toLowerCase()}.com/login`;
  uri.match = UriMatchStrategy.Domain;
  login.uris = [uri];
  cipher.login = login;
  return cipher;
}

function makeSearchService(): SearchService {
  const mockLogService = {
    error: jest.fn(),
    info: jest.fn(),
    measure: jest.fn(),
  };
  const mockI18nService = {
    locale$: new BehaviorSubject<string>("en").asObservable(),
  };
  return new SearchService(
    mockLogService as unknown as LogService,
    mockI18nService as unknown as I18nService,
  );
}

/**
 * Models the same observable shape used by `vault.component.ts` for the
 * desktop vault list, simplified to the parts that gate first-paint of
 * search results: the cipher list source, the search text, and a
 * `concatMap` filter through SearchService.
 */
function buildVaultPipeline(
  service: SearchService,
  userId: UserId,
  cipherListViews$: Subject<CipherView[]>,
  searchText$: Subject<string>,
) {
  const ciphers$ = combineLatest([
    cipherListViews$.pipe(filter((c) => c != null)),
    searchText$,
  ]).pipe(
    concatMap(async ([ciphers, query]) => {
      if (!(await service.isSearchable(query))) {
        return ciphers;
      }
      return await service.searchCiphers(userId, null, query, ciphers);
    }),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  return ciphers$.pipe(map((arr) => arr.length));
}

describe("vault search pipeline lag (reproduces 3s desktop search delay)", () => {
  const userId = "user-id" as UserId;
  let ciphers: CipherView[];

  beforeAll(() => {
    ciphers = Array.from({ length: N_CIPHERS }, (_, i) => buildCipher(i));
  });

  it("LAZY first-subscribe (current vault.component behavior): user waits ~decrypt time", async () => {
    const service = makeSearchService();
    // ReplaySubject(1) mimics `perUserCache$`'s shareReplay({ bufferSize: 1 }).
    const cipherListViews$ = new ReplaySubject<CipherView[]>(1);
    const searchText$ = new BehaviorSubject<string>("");

    const ciphers$ = buildVaultPipeline(service, userId, cipherListViews$, searchText$);

    // ---- Login completes; vault.component mounts and subscribes ----
    // Schedule decrypt to "complete" after FAKE_DECRYPT_DELAY_MS
    setTimeout(() => cipherListViews$.next(ciphers), FAKE_DECRYPT_DELAY_MS);

    // User types "facebook" right away
    const userTypedAt = performance.now();
    searchText$.next("facebook");

    const firstResultLength = await firstValueFrom(ciphers$);
    const userWaitedMs = performance.now() - userTypedAt;

    // eslint-disable-next-line no-console
    console.log(
      `[lag][LAZY] user waited ${userWaitedMs.toFixed(0)}ms for first results ` +
        `(matched ${firstResultLength} of ${N_CIPHERS} ciphers)`,
    );

    expect(firstResultLength).toBeGreaterThan(0);
    expect(userWaitedMs).toBeGreaterThanOrEqual(FAKE_DECRYPT_DELAY_MS - 100);
  }, 15_000);

  it("EAGER pre-warmed (proposed fix): user sees results in ~basic-search time", async () => {
    const service = makeSearchService();
    // ReplaySubject(1) mimics `perUserCache$`'s shareReplay({ bufferSize: 1 }).
    const cipherListViews$ = new ReplaySubject<CipherView[]>(1);
    const searchText$ = new BehaviorSubject<string>("");

    // ---- App-level service subscribes on login/unlock, BEFORE the vault page mounts. ----
    // This is what we'll add in the real fix: a pre-warm subscription so that
    // by the time vault.component subscribes, the shareReplay cache is hot.
    const preWarmSub = cipherListViews$.subscribe();

    // Decrypt finishes at the usual time, but it's already in flight.
    setTimeout(() => cipherListViews$.next(ciphers), FAKE_DECRYPT_DELAY_MS);

    // ... user reaches the vault page some time after login.
    // We model that by waiting for decrypt to finish before mounting the pipeline.
    await new Promise((r) => setTimeout(r, FAKE_DECRYPT_DELAY_MS + 50));

    const ciphers$ = buildVaultPipeline(service, userId, cipherListViews$, searchText$);

    // The cache is hot; user types and immediately gets results.
    const userTypedAt = performance.now();
    searchText$.next("facebook");
    const firstResultLength = await firstValueFrom(ciphers$);
    const userWaitedMs = performance.now() - userTypedAt;

    // eslint-disable-next-line no-console
    console.log(
      `[lag][EAGER] user waited ${userWaitedMs.toFixed(0)}ms for first results ` +
        `(matched ${firstResultLength} of ${N_CIPHERS} ciphers)`,
    );

    expect(firstResultLength).toBeGreaterThan(0);
    expect(userWaitedMs).toBeLessThan(200);

    preWarmSub.unsubscribe();
  }, 15_000);
});
