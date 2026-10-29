import { firstValueFrom } from "rxjs";

import { PasswordProtectedKeyEnvelope } from "@bitwarden/sdk-internal";
import { FakeStateProvider } from "@bitwarden/state-test-utils";
import { UserId } from "@bitwarden/user-core";

import { mockAccountServiceWith } from "../../spec";

import { JsWasmStateBridge } from "./state-bridge";
import { PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL } from "./state-definitions";

// Well below the bridge's 1000 ms wait for a written value to show up in state.
const FAST_MS = 200;

describe("JsWasmStateBridge", () => {
  const userId = "user-id" as UserId;
  let stateProvider: FakeStateProvider;
  let bridge: JsWasmStateBridge;

  beforeEach(() => {
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    bridge = new JsWasmStateBridge(stateProvider, userId);
  });

  /** Resolves `"done"` if `work` finishes within {@link FAST_MS}, `"slow"` otherwise. */
  const settlesFast = (work: Promise<unknown>) =>
    Promise.race([
      work.then(() => "done"),
      new Promise((resolve) => setTimeout(() => resolve("slow"), FAST_MS)),
    ]);

  it("returns once the written value is in state", async () => {
    const envelope = "envelope-a" as PasswordProtectedKeyEnvelope;

    await expect(settlesFast(bridge.set_ephemeral_pin_envelope(envelope))).resolves.toBe("done");
    expect(
      await firstValueFrom(
        stateProvider.getUserState$(PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL, userId),
      ),
    ).toBe(envelope);
  });

  it("does not wait out the timeout when a concurrent write replaces the value", async () => {
    // Each envelope is freshly encrypted, so two writers store different values.
    const writes = Promise.all([
      bridge.set_ephemeral_pin_envelope("envelope-a" as PasswordProtectedKeyEnvelope),
      bridge.set_ephemeral_pin_envelope("envelope-b" as PasswordProtectedKeyEnvelope),
    ]);

    await expect(settlesFast(writes)).resolves.toBe("done");
  });
});
