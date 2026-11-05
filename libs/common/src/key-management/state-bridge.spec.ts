import { mock } from "jest-mock-extended";

// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

import { mockAccountServiceWith } from "../../spec/fake-account-service";
import { FakeStateProvider } from "../../spec/fake-state-provider";
import { UserId } from "../types/guid";
import { DeviceKey } from "../types/key";

import { DeviceTrustStore, JsWasmStateBridge } from "./state-bridge";

describe("JsWasmStateBridge device trust", () => {
  const userId = "00000000-0000-0000-0000-000000000001" as UserId;
  const deviceKey = new SymmetricCryptoKey(new Uint8Array(64)) as DeviceKey;

  let store: ReturnType<typeof mock<DeviceTrustStore>>;
  let bridge: JsWasmStateBridge;

  beforeEach(() => {
    store = mock<DeviceTrustStore>();
    const stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    bridge = new JsWasmStateBridge(stateProvider, userId, store);
  });

  it("stores the device key through device trust storage", async () => {
    await bridge.set_device_key(deviceKey.toSdk());

    const [storedUserId, storedKey] = store.setDeviceKey.mock.calls[0];
    expect(storedUserId).toBe(userId);
    expect(storedKey?.toSdk()).toEqual(deviceKey.toSdk());
  });

  it("reads the device key from device trust storage", async () => {
    store.getDeviceKey.mockResolvedValue(deviceKey);

    expect(await bridge.get_device_key()).toEqual(deviceKey.toSdk());
  });

  it("reports no device key as null", async () => {
    store.getDeviceKey.mockResolvedValue(null);

    expect(await bridge.get_device_key()).toBeNull();
  });

  it("clears the device key", async () => {
    await bridge.clear_device_key();

    expect(store.setDeviceKey).toHaveBeenCalledWith(userId, null);
  });

  it("stores, reads and clears the trust choice", async () => {
    store.getShouldTrustDevice.mockResolvedValue(true);

    await bridge.set_should_trust_device(true);
    const choice = await bridge.get_should_trust_device();
    await bridge.clear_should_trust_device();

    expect(store.setShouldTrustDevice).toHaveBeenNthCalledWith(1, userId, true);
    expect(choice).toBe(true);
    expect(store.setShouldTrustDevice).toHaveBeenNthCalledWith(2, userId, null);
  });

  it("fails loudly when built without device trust storage", async () => {
    const stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    const registrationBridge = new JsWasmStateBridge(stateProvider, userId);

    await expect(registrationBridge.get_device_key()).rejects.toThrow(
      "Device trust storage is not available",
    );
  });
});
