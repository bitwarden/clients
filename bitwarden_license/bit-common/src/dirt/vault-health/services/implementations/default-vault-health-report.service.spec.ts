import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import type { CipherRiskResult } from "@bitwarden/sdk-internal";

import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultVaultHealthReportService } from "./default-vault-health-report.service";

describe("DefaultVaultHealthReportService", () => {
  const userId = "test-user-id" as UserId;

  let cipherService: ReturnType<typeof mock<CipherService>>;
  let cipherRiskService: ReturnType<typeof mock<CipherRiskService>>;
  let cipherViews$: BehaviorSubject<CipherView[]>;
  let service: DefaultVaultHealthReportService;

  // Per-test lookup so risk results are returned for exactly the ciphers passed,
  // keyed by id (mirrors the SDK, which stamps each result with its cipher id).
  let riskById: Map<string, CipherRiskResult>;

  beforeEach(() => {
    cipherService = mock<CipherService>();
    cipherRiskService = mock<CipherRiskService>();
    cipherViews$ = new BehaviorSubject<CipherView[]>([]);
    riskById = new Map();

    cipherService.cipherViews$.mockReturnValue(cipherViews$);
    cipherRiskService.buildPasswordReuseMap.mockResolvedValue({});
    cipherRiskService.computeRiskForCiphers.mockImplementation(async (ciphers) =>
      ciphers.map((c) => riskById.get(c.id)!),
    );

    service = new DefaultVaultHealthReportService(cipherService, cipherRiskService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- helpers -------------------------------------------------------------

  const login = (
    id: string,
    opts: {
      password?: string;
      organizationId?: string | null;
      deleted?: boolean;
      type?: CipherType;
    } = {},
  ): CipherView => {
    const cipher = new CipherView();
    cipher.id = id;
    cipher.type = opts.type ?? CipherType.Login;
    cipher.organizationId = (opts.organizationId ?? null) as CipherView["organizationId"];
    cipher.deletedDate = opts.deleted ? new Date() : (null as unknown as Date);
    cipher.login = new LoginView();
    cipher.login.password = opts.password ?? `pw-${id}`;
    return cipher;
  };

  const risk = (
    id: string,
    opts: { strength?: number; exposed?: number; reuse?: number } = {},
  ): CipherRiskResult => {
    const exposed = opts.exposed ?? 0;
    return {
      id,
      password_strength: opts.strength ?? 4,
      exposed_result: exposed > 0 ? { type: "Found", value: exposed } : { type: "NotChecked" },
      reuse_count: opts.reuse ?? 1,
    } as unknown as CipherRiskResult;
  };

  /** Seed the vault with logins and register a risk result for each by id. */
  const seed = (entries: { cipher: CipherView; risk: CipherRiskResult }[]) => {
    entries.forEach((e) => riskById.set(e.cipher.id, e.risk));
    cipherViews$.next(entries.map((e) => e.cipher));
  };

  const report = () => firstValueFrom(service.vaultHealthReport$(userId));

  // --- tests ---------------------------------------------------------------

  it("categorizes each single-risk login into its matching category", async () => {
    seed([
      { cipher: login("a"), risk: risk("a", { exposed: 3 }) },
      { cipher: login("b"), risk: risk("b", { strength: 1 }) },
      { cipher: login("c"), risk: risk("c", { reuse: 2 }) },
    ]);

    const result = await report();

    expect(result.categoryCounts).toEqual({ exposed: 1, weak: 1, reused: 1 });
    expect(result.categoryItems.exposed.map((h) => h.cipherId)).toEqual(["a"]);
    expect(result.categoryItems.weak.map((h) => h.cipherId)).toEqual(["b"]);
    expect(result.categoryItems.reused.map((h) => h.cipherId)).toEqual(["c"]);
  });

  it("counts an exposed+weak+reused login once, under Exposed (highest-risk-wins)", async () => {
    seed([{ cipher: login("a"), risk: risk("a", { strength: 1, exposed: 5, reuse: 3 }) }]);

    const result = await report();

    expect(result.atRiskCount).toBe(1);
    expect(result.categoryCounts).toEqual({ exposed: 1, weak: 0, reused: 0 });
    expect(result.categoryItems.exposed.map((h) => h.cipherId)).toEqual(["a"]);
    // Full per-login breakdown still reflects all categories the login is at risk in.
    const health = result.cipherHealth.find((h) => h.cipherId === "a")!;
    expect(health.hasExposedPassword).toBe(true);
    expect(health.hasWeakPassword).toBe(true);
    expect(health.hasReusedPassword).toBe(true);
  });

  it("places a weak+reused (not exposed) login under Weak", async () => {
    seed([{ cipher: login("a"), risk: risk("a", { strength: 2, reuse: 4 }) }]);

    const result = await report();

    expect(result.categoryCounts).toEqual({ exposed: 0, weak: 1, reused: 0 });
    const health = result.cipherHealth.find((h) => h.cipherId === "a")!;
    expect(health.hasWeakPassword).toBe(true);
    expect(health.hasReusedPassword).toBe(true);
  });

  it("scores unique at-risk logins over total logins", async () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      cipher: login(`c${i}`),
      risk: i < 3 ? risk(`c${i}`, { strength: 1 }) : risk(`c${i}`),
    }));
    seed(entries);

    const result = await report();

    expect(result.totalCount).toBe(10);
    expect(result.atRiskCount).toBe(3);
    expect(result.score).toBeCloseTo(0.3);
  });

  it("returns an empty report with score 0 when there are no scoped logins", async () => {
    cipherViews$.next([]);

    const result = await report();

    expect(result.totalCount).toBe(0);
    expect(result.atRiskCount).toBe(0);
    expect(result.score).toBe(0);
    expect(result.categoryCounts).toEqual({ exposed: 0, weak: 0, reused: 0 });
    expect(cipherRiskService.computeRiskForCiphers).not.toHaveBeenCalled();
  });

  it("reports zero at risk when all logins are healthy", async () => {
    seed([
      { cipher: login("a"), risk: risk("a") },
      { cipher: login("b"), risk: risk("b") },
      { cipher: login("c"), risk: risk("c") },
    ]);

    const result = await report();

    expect(result.atRiskCount).toBe(0);
    expect(result.score).toBe(0);
    expect(result.categoryCounts).toEqual({ exposed: 0, weak: 0, reused: 0 });
    expect(result.cipherHealth).toHaveLength(3);
  });

  it("excludes org items, deleted items, non-logins, and passwordless logins from scope", async () => {
    const personal = login("personal", { strength: 1 });
    riskById.set(personal.id, risk("personal", { strength: 1 }));
    cipherViews$.next([
      personal,
      login("org", { organizationId: "org-1" }),
      login("deleted", { deleted: true }),
      login("card", { type: CipherType.Card }),
      login("nopass", { password: "" }),
    ]);

    const result = await report();

    expect(result.totalCount).toBe(1);
    const passed = cipherRiskService.computeRiskForCiphers.mock.calls[0][0];
    expect(passed.map((c) => c.id)).toEqual(["personal"]);
  });

  it("re-emits an updated report when the vault changes", async () => {
    seed([
      { cipher: login("a"), risk: risk("a", { strength: 1 }) },
      { cipher: login("b"), risk: risk("b") },
    ]);
    const emissions: number[] = [];
    const sub = service.vaultHealthReport$(userId).subscribe((r) => emissions.push(r.atRiskCount));

    // allow the first async report to resolve
    await new Promise((resolve) => setTimeout(resolve, 0));

    seed([
      { cipher: login("a"), risk: risk("a", { strength: 1 }) },
      { cipher: login("b"), risk: risk("b", { exposed: 2 }) },
      { cipher: login("c"), risk: risk("c", { reuse: 2 }) },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    sub.unsubscribe();
    expect(emissions[0]).toBe(1);
    expect(emissions[emissions.length - 1]).toBe(3);
  });

  it("propagates errors from the risk computation instead of swallowing them", async () => {
    seed([{ cipher: login("a"), risk: risk("a") }]);
    cipherRiskService.computeRiskForCiphers.mockRejectedValueOnce(new Error("HIBP unavailable"));

    await expect(report()).rejects.toThrow("HIBP unavailable");
  });

  it("enables the exposed check and passes the pre-built reuse map", async () => {
    const reuseMap = { "pw-a": 1 };
    cipherRiskService.buildPasswordReuseMap.mockResolvedValue(reuseMap);
    seed([{ cipher: login("a"), risk: risk("a") }]);

    await report();

    expect(cipherRiskService.computeRiskForCiphers).toHaveBeenCalledWith(expect.any(Array), userId, {
      passwordMap: reuseMap,
      checkExposed: true,
    });
  });

  it("maps each result to its cipher by id, not by array position", async () => {
    const a = login("a");
    const b = login("b");
    const c = login("c");
    riskById.set("a", risk("a", { exposed: 4 }));
    riskById.set("b", risk("b", { strength: 1 }));
    riskById.set("c", risk("c", { reuse: 2 }));
    cipherViews$.next([a, b, c]);
    // Return results in a different order than the inputs.
    cipherRiskService.computeRiskForCiphers.mockResolvedValueOnce([
      riskById.get("c")!,
      riskById.get("a")!,
      riskById.get("b")!,
    ]);

    const result = await report();

    expect(result.categoryItems.exposed.map((h) => h.cipherId)).toEqual(["a"]);
    expect(result.categoryItems.weak.map((h) => h.cipherId)).toEqual(["b"]);
    expect(result.categoryItems.reused.map((h) => h.cipherId)).toEqual(["c"]);
  });
});
