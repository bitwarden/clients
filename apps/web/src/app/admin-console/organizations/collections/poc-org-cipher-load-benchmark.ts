// ============================================================================================
// POC-PERF: TEMPORARY SPEED TEST. DO NOT SHIP TO PRODUCTION.
// Remove this entire file, plus every block marked "POC-PERF" in vault.component.ts, before
// this change is released.
//
// Compares the old Admin Console cipher load path (the SDK decrypts every cipher to an unused
// list view, then the client decrypts each cipher again, one SDK call at a time) against the
// new single SDK call that decrypts straight to full cipher views.
//
// Usage: open an organization's Admin Console vault, then run in the DevTools console:
//   await bwPocOrgCipherBenchmark()      // 3 iterations
//   await bwPocOrgCipherBenchmark(5)     // 5 iterations
// Only timings and cipher counts are logged, never vault data.
// ============================================================================================
/* eslint-disable no-console */

import { firstValueFrom } from "rxjs";

import { SdkService, asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { OrganizationId as SdkOrganizationId } from "@bitwarden/sdk-internal";

type Scenario = { name: string; run: () => Promise<number> };

export async function runOrgCipherLoadBenchmark(
  sdkService: SdkService,
  userId: UserId,
  organizationId: string,
  includeMemberItems: boolean,
  iterations = 3,
): Promise<void> {
  const sdk = await firstValueFrom(sdkService.userClient$(userId));
  if (sdk == null) {
    throw new Error("SDK client is not available");
  }
  using ref = sdk.take();
  const ciphersClient = ref.value.vault().ciphers();
  const adminClient = ciphersClient.admin();
  const orgId = asUuid<SdkOrganizationId>(organizationId);

  // Old path: list_org_ciphers decrypts every cipher to a list view that is thrown away, then each
  // cipher is converted and decrypted again in its own SDK call.
  const decryptOneByOne = async (sdkCiphers: Cipher[]) => {
    const views: CipherView[] = [];
    for (const cipher of sdkCiphers) {
      try {
        const sdkView = await ciphersClient.decrypt(cipher.toSdkCipher());
        views.push(CipherView.fromSdkCipherView(sdkView)!);
      } catch {
        // Failures are counted by length below
      }
    }
    return views;
  };

  // Encrypted ciphers fetched once, so the decrypt-only scenarios compare the same data with no
  // network time.
  const encrypted = await adminClient.get_org_ciphers(orgId, includeMemberItems);

  const scenarios: Scenario[] = [
    {
      name: "old: end-to-end (list_org_ciphers + per-cipher decrypt)",
      run: async () => {
        const result = await adminClient.list_org_ciphers(orgId, includeMemberItems);
        const ciphers = result.ciphers
          .map((c) => Cipher.fromSdkCipher(c))
          .filter((c): c is Cipher => c !== undefined);
        return (await decryptOneByOne(ciphers)).length;
      },
    },
    {
      name: "new: end-to-end (list_org_cipher_views)",
      run: async () => {
        const result = await adminClient.list_org_cipher_views(orgId, includeMemberItems);
        return result.successes.map((v) => CipherView.fromSdkCipherView(v)).length;
      },
    },
    {
      name: "old: decrypt only (list views + per-cipher decrypt)",
      run: async () => {
        await ciphersClient.decrypt_list_with_failures(encrypted);
        const ciphers = encrypted
          .map((c) => Cipher.fromSdkCipher(c))
          .filter((c): c is Cipher => c !== undefined);
        return (await decryptOneByOne(ciphers)).length;
      },
    },
    {
      name: "new: decrypt only (decrypt_list_full_with_failures)",
      run: async () => {
        const result = await ciphersClient.decrypt_list_full_with_failures(encrypted);
        return result.successes.map((v) => CipherView.fromSdkCipherView(v)).length;
      },
    },
  ];

  const timings = new Map<string, number[]>(scenarios.map((s): [string, number[]] => [s.name, []]));
  const decryptedCounts = new Map<string, number>();

  // Scenarios are interleaved within each iteration so caching and JIT warm-up affect them evenly
  for (let i = 0; i < iterations; i++) {
    for (const scenario of scenarios) {
      const start = performance.now();
      decryptedCounts.set(scenario.name, await scenario.run());
      timings.get(scenario.name)!.push(performance.now() - start);
    }
  }

  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  console.info(
    `[POC-PERF] Org cipher load benchmark: ${encrypted.length} ciphers, ${iterations} iterations`,
  );
  console.table(
    scenarios.map(({ name }) => {
      const runs = timings.get(name)!;
      return {
        scenario: name,
        "median ms": Math.round(median(runs)),
        "min ms": Math.round(Math.min(...runs)),
        "max ms": Math.round(Math.max(...runs)),
        decrypted: decryptedCounts.get(name),
      };
    }),
  );
}
// POC-PERF: END OF TEMPORARY SPEED TEST FILE
