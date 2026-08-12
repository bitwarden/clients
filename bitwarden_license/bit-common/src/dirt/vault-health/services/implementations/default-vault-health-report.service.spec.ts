import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import type { CipherRiskResult } from "@bitwarden/sdk-internal";

import { CipherHealthView } from "../../../access-intelligence/models/view/cipher-health.view";
import {
  VaultHealthReportItem,
  VaultHealthReportView,
} from "../../models/view/vault-health-report.view";

import { DefaultVaultHealthReportService } from "./default-vault-health-report.service";

describe("DefaultVaultHealthReportService", () => {
  const userId = "test-user-id" as UserId;

  let cipherRiskService: ReturnType<typeof mock<CipherRiskService>>;
  let service: DefaultVaultHealthReportService;

  // Per-test lookup so risk results are returned for exactly the ciphers passed,
  // keyed by id (mirrors the SDK, which stamps each result with its cipher id).
  let riskById: Map<string, CipherRiskResult>;

  beforeEach(() => {
    cipherRiskService = mock<CipherRiskService>();
    riskById = new Map();

    cipherRiskService.buildPasswordReuseMap.mockResolvedValue({});
    cipherRiskService.computeRiskForCiphers.mockImplementation(async (ciphers) =>
      ciphers.map((c) => riskById.get(c.id)!),
    );

    service = new DefaultVaultHealthReportService(cipherRiskService);
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

  /** Register a risk result per cipher id and return the cipher list to pass in. */
  const withRisks = (entries: { cipher: CipherView; risk: CipherRiskResult }[]): CipherView[] => {
    entries.forEach((e) => riskById.set(e.cipher.id, e.risk));
    return entries.map((e) => e.cipher);
  };

  /** Runs a scan and reads the report the service published for it. */
  const report = async (ciphers: CipherView[]): Promise<VaultHealthReportView> => {
    await service.buildVaultHealthReport$(ciphers, userId);
    return (await firstValueFrom(service.getVaultHealthReport$()))!;
  };

  /** The health views bucketed into a category, in order. */
  const health = (items: VaultHealthReportItem[]): CipherHealthView[] =>
    items.map((item) => item.health);

  const cipherIds = (items: VaultHealthReportItem[]): string[] =>
    items.map((item) => item.health.cipherId);

  // --- tests ---------------------------------------------------------------

  it("categorizes each single-risk login into its matching category", async () => {
    const ciphers = withRisks([
      { cipher: login("a"), risk: risk("a", { exposed: 3 }) },
      { cipher: login("b"), risk: risk("b", { strength: 1 }) },
      { cipher: login("c"), risk: risk("c", { reuse: 2 }) },
    ]);

    const result = await report(ciphers);

    expect(cipherIds(result.categoryItems.exposed)).toEqual(["a"]);
    expect(cipherIds(result.categoryItems.weak)).toEqual(["b"]);
    expect(cipherIds(result.categoryItems.reused)).toEqual(["c"]);
  });

  it("counts an exposed+weak+reused login once, under Exposed (highest-risk-wins)", async () => {
    const ciphers = withRisks([
      { cipher: login("a"), risk: risk("a", { strength: 1, exposed: 5, reuse: 3 }) },
    ]);

    const result = await report(ciphers);

    expect(result.atRiskCount).toBe(1);
    expect(cipherIds(result.categoryItems.exposed)).toEqual(["a"]);
    expect(result.categoryItems.weak).toHaveLength(0);
    expect(result.categoryItems.reused).toHaveLength(0);
    // The bucketed item still carries every category it is at risk in, so the
    // cross-category view is available without a separate flat list.
    const [bucketed] = health(result.categoryItems.exposed);
    expect(bucketed.hasExposedPassword).toBe(true);
    expect(bucketed.hasWeakPassword).toBe(true);
    expect(bucketed.hasReusedPassword).toBe(true);
  });

  it("places a weak+reused (not exposed) login under Weak", async () => {
    const ciphers = withRisks([{ cipher: login("a"), risk: risk("a", { strength: 2, reuse: 4 }) }]);

    const result = await report(ciphers);

    expect(result.categoryItems.exposed).toHaveLength(0);
    expect(cipherIds(result.categoryItems.weak)).toEqual(["a"]);
    expect(result.categoryItems.reused).toHaveLength(0);
    const [bucketed] = health(result.categoryItems.weak);
    expect(bucketed.hasWeakPassword).toBe(true);
    expect(bucketed.hasReusedPassword).toBe(true);
  });

  it("scores unique at-risk logins over total logins", async () => {
    const ciphers = withRisks(
      Array.from({ length: 10 }, (_, i) => ({
        cipher: login(`c${i}`),
        risk: i < 3 ? risk(`c${i}`, { strength: 1 }) : risk(`c${i}`),
      })),
    );

    const result = await report(ciphers);

    expect(result.totalCount).toBe(10);
    expect(result.atRiskCount).toBe(3);
    expect(result.score).toBeCloseTo(0.3);
  });

  it("returns an empty report with score 0 when there are no scoped logins", async () => {
    const result = await report([]);

    expect(result.totalCount).toBe(0);
    expect(result.atRiskCount).toBe(0);
    expect(result.score).toBe(0);
    expect(result.categoryItems.exposed).toHaveLength(0);
    expect(result.categoryItems.weak).toHaveLength(0);
    expect(result.categoryItems.reused).toHaveLength(0);
    expect(cipherRiskService.computeRiskForCiphers).not.toHaveBeenCalled();
  });

  it("reports zero at risk when all logins are healthy", async () => {
    const ciphers = withRisks([
      { cipher: login("a"), risk: risk("a") },
      { cipher: login("b"), risk: risk("b") },
      { cipher: login("c"), risk: risk("c") },
    ]);

    const result = await report(ciphers);

    expect(result.totalCount).toBe(3);
    expect(result.atRiskCount).toBe(0);
    expect(result.score).toBe(0);
    expect(result.categoryItems.exposed).toHaveLength(0);
    expect(result.categoryItems.weak).toHaveLength(0);
    expect(result.categoryItems.reused).toHaveLength(0);
  });

  it("excludes org items, deleted items, non-logins, and passwordless logins from scope", async () => {
    const personal = login("personal");
    riskById.set(personal.id, risk("personal", { strength: 1 }));
    const ciphers = [
      personal,
      login("org", { organizationId: "org-1" }),
      login("deleted", { deleted: true }),
      login("card", { type: CipherType.Card }),
      login("nopass", { password: "" }),
    ];

    const result = await report(ciphers);

    expect(result.totalCount).toBe(1);
    const passed = cipherRiskService.computeRiskForCiphers.mock.calls[0][0];
    expect(passed.map((c) => c.id)).toEqual(["personal"]);
  });

  it("propagates errors from the risk computation instead of swallowing them", async () => {
    const ciphers = withRisks([{ cipher: login("a"), risk: risk("a") }]);
    cipherRiskService.computeRiskForCiphers.mockRejectedValueOnce(new Error("HIBP unavailable"));

    await expect(service.buildVaultHealthReport$(ciphers, userId)).rejects.toThrow(
      "HIBP unavailable",
    );
  });

  it("enables the exposed check and passes the pre-built reuse map", async () => {
    const reuseMap = { "pw-a": 1 };
    cipherRiskService.buildPasswordReuseMap.mockResolvedValue(reuseMap);
    const ciphers = withRisks([{ cipher: login("a"), risk: risk("a") }]);

    await report(ciphers);

    expect(cipherRiskService.computeRiskForCiphers).toHaveBeenCalledWith(
      expect.any(Array),
      userId,
      {
        passwordMap: reuseMap,
        checkExposed: true,
      },
    );
  });

  it("maps each result to its cipher by id, not by array position", async () => {
    const a = login("a");
    const b = login("b");
    const c = login("c");
    riskById.set("a", risk("a", { exposed: 4 }));
    riskById.set("b", risk("b", { strength: 1 }));
    riskById.set("c", risk("c", { reuse: 2 }));
    // Return results in a different order than the inputs.
    cipherRiskService.computeRiskForCiphers.mockResolvedValueOnce([
      riskById.get("c")!,
      riskById.get("a")!,
      riskById.get("b")!,
    ]);

    const result = await report([a, b, c]);

    expect(cipherIds(result.categoryItems.exposed)).toEqual(["a"]);
    expect(cipherIds(result.categoryItems.weak)).toEqual(["b"]);
    expect(cipherIds(result.categoryItems.reused)).toEqual(["c"]);
  });

  // --- the published report ------------------------------------------------

  describe("getVaultHealthReport$", () => {
    it("emits null before any scan has run", async () => {
      // Null rather than an empty report, so the Health tab can tell "not scanned
      // yet" from "scanned, nothing at risk" and avoid flashing a false healthy
      // reading while the breach lookup is still in flight.
      await expect(firstValueFrom(service.getVaultHealthReport$())).resolves.toBeNull();
    });

    it("replays the latest report to a subscriber that arrives after the scan", async () => {
      // The Risk Category Detail page subscribes on navigation, long after the
      // overview triggered the scan, and reads this replayed value.
      const ciphers = withRisks([{ cipher: login("a"), risk: risk("a", { exposed: 3 }) }]);
      await service.buildVaultHealthReport$(ciphers, userId);

      const replayed = await firstValueFrom(service.getVaultHealthReport$());

      expect(cipherIds(replayed!.categoryItems.exposed)).toEqual(["a"]);
    });

    it("pushes each rescan to existing subscribers", async () => {
      const emissions: (VaultHealthReportView | null)[] = [];
      const subscription = service.getVaultHealthReport$().subscribe((r) => emissions.push(r));

      await service.buildVaultHealthReport$(
        withRisks([{ cipher: login("a"), risk: risk("a", { strength: 1 }) }]),
        userId,
      );
      await service.buildVaultHealthReport$(
        withRisks([
          { cipher: login("a"), risk: risk("a", { strength: 1 }) },
          { cipher: login("b"), risk: risk("b", { strength: 1 }) },
        ]),
        userId,
      );
      subscription.unsubscribe();

      expect(emissions[0]).toBeNull();
      expect(emissions[1]!.atRiskCount).toBe(1);
      expect(emissions[2]!.atRiskCount).toBe(2);
    });
  });

  it("includes each at-risk login's cipher alongside its health metrics", async () => {
    const a = login("a");
    const ciphers = withRisks([{ cipher: a, risk: risk("a", { exposed: 3 }) }]);

    const result = await report(ciphers);

    const [item] = result.categoryItems.exposed;
    expect(item).toBeInstanceOf(VaultHealthReportItem);
    expect(item.cipher).toBe(a);
    expect(item.health.cipherId).toBe("a");
  });
});
