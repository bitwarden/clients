import { Utils } from "@bitwarden/common/platform/misc/utils";

import {
  DDGEncryptedResponse,
  DDGEphemeralPrivateKey,
  DDGError,
  DDGHandshakeRefused,
  DDGHandshakeResponse,
  DDGResponderHost,
  DDGSessionKey,
  DuckDuckGoInitiator,
  DuckDuckGoResponder,
  InitiatorState,
  decrypt,
  Padding,
  ResponderState,
  encrypt,
} from "./index";

// PureCrypto is WebAssembly, so it is stood in for. The key only has to be 64 bytes and distinct
// from every other mint — re-pairing is required to retire the previous key, which a constant
// would hide.
let generateCount = 0;
/** A distinct key per call, so re-pairing cannot appear to work by reusing the same one. */
const generatedKey = (nth: number) => new Uint8Array(64).fill(nth);
jest.mock("@bitwarden/sdk-internal", () => ({
  SdkRandomNumberClient: jest.fn(() => ({ gen_bytes: () => generatedKey(generateCount++) })),
}));

describe("the DuckDuckGo protocol", () => {
  let host: jest.Mocked<DDGResponderHost>;
  let responder: DuckDuckGoResponder;
  let initiator: DuckDuckGoInitiator;

  // 2048-bit RSA keygen costs seconds, so one pair is generated for the whole suite and every
  // handshake is handed it. Nothing in the protocol pins anything to the pair, so sharing it
  // changes no behaviour under test.
  beforeAll(() => {
    const pair = DDGEphemeralPrivateKey.generatePair();
    jest.spyOn(DDGEphemeralPrivateKey, "generatePair").mockReturnValue(pair);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    host = {
      confirmPairing: jest.fn().mockResolvedValue(true),
      runCommand: jest.fn().mockResolvedValue({ status: "success" }),
    };
    responder = new DuckDuckGoResponder(host);
    initiator = new DuckDuckGoInitiator("DuckDuckGo");
  });

  /** Runs a handshake end to end, leaving both sides paired. */
  async function pair(): Promise<void> {
    const response = (await responder.handle(initiator.startHandshake())) as DDGHandshakeResponse;
    initiator.receive(response);
  }

  it("pairs, then carries a command and its response", async () => {
    await pair();

    expect(initiator.currentState).toBe(InitiatorState.Paired);
    expect(responder.currentState).toBe(ResponderState.Paired);

    host.runCommand.mockResolvedValue({ userName: "ada" });
    const request = initiator.sendCommand("bw-credential-retrieval", { url: "example.com" });
    const response = (await responder.handle(request)) as DDGEncryptedResponse;

    expect(host.runCommand).toHaveBeenCalledWith({
      command: "bw-credential-retrieval",
      payload: { url: "example.com" },
    });
    expect(initiator.receive(response)).toEqual({
      command: "bw-credential-retrieval",
      payload: { userName: "ada" },
    });
  });

  it("carries a payload whose length is an exact block multiple, in both paddings", async () => {
    await pair();

    // 16 bytes of JSON-safe content: PKCS#7 adds a whole extra block, zero padding adds nothing.
    const exactlyOneBlock = "0123456789abcdef";
    host.runCommand.mockResolvedValue({ echo: exactlyOneBlock });

    const request = initiator.sendCommand("bw-status", { probe: exactlyOneBlock });
    const response = (await responder.handle(request)) as DDGEncryptedResponse;

    expect(host.runCommand).toHaveBeenCalledWith({
      command: "bw-status",
      payload: { probe: exactlyOneBlock },
    });
    expect(initiator.receive(response)).toEqual({
      command: "bw-status",
      payload: { echo: exactlyOneBlock },
    });
  });

  it("refuses the session when the user declines", async () => {
    host.confirmPairing.mockResolvedValue(false);
    const handshake = initiator.startHandshake();

    const response = (await responder.handle(handshake)) as DDGHandshakeResponse;

    expect(response.payload).toEqual({ error: DDGError.Canceled });
    expect(responder.currentState).toBe(ResponderState.Refused);
    expect(() => initiator.receive(response)).toThrow(DDGHandshakeRefused);
    expect(initiator.currentState).toBe(InitiatorState.Refused);
  });

  it("will not run a command for a peer it refused", async () => {
    host.confirmPairing.mockResolvedValue(false);
    const handshake = initiator.startHandshake();
    await responder.handle(handshake);

    // The peer tries anyway, with a key of its own choosing.
    const forged = {
      version: 1,
      messageId: "99",
      encryptedCommand: encrypt(
        JSON.stringify({ command: "bw-status" }),
        DDGSessionKey.fromBytes(generatedKey(0)),
        Padding.Zero,
      ),
    };
    const response = (await responder.handle(forged)) as DDGHandshakeResponse;

    expect(response.payload).toEqual({ error: DDGError.CannotDecrypt });
    expect(host.runCommand).not.toHaveBeenCalled();
  });

  describe("the state machines reject what their state does not allow", () => {
    it("the initiator will not send a command before pairing", () => {
      expect(initiator.currentState).toBe(InitiatorState.Disconnected);

      expect(() => initiator.sendCommand("bw-status")).toThrow(/Disconnected|disconnected/);
    });

    it("the initiator will not read a reply it never asked for", () => {
      expect(() =>
        initiator.receive({
          version: 1,
          messageId: "1",
          payload: { status: "success", sharedKey: "" },
        }),
      ).toThrow(/disconnected/);
    });

    it("the initiator will not start a second handshake while one is outstanding", () => {
      initiator.startHandshake();

      expect(() => initiator.startHandshake()).toThrow(/already outstanding/);
    });

    it("the initiator will not send a command after a refusal", async () => {
      host.confirmPairing.mockResolvedValue(false);
      const response = (await responder.handle(initiator.startHandshake())) as DDGHandshakeResponse;
      expect(() => initiator.receive(response)).toThrow(DDGHandshakeRefused);

      expect(() => initiator.sendCommand("bw-status")).toThrow(/refused/);
    });

    it("the responder serves nothing while it is waiting on the user", async () => {
      // Hold the dialog open, so the responder stays in AwaitingVerification.
      let answer: (accepted: boolean) => void;
      host.confirmPairing.mockReturnValue(new Promise((resolve) => (answer = resolve)));
      const first = responder.handle(initiator.startHandshake());

      expect(responder.currentState).toBe(ResponderState.AwaitingVerification);
      const second = (await responder.handle({
        version: 1,
        messageId: "2",
        encryptedCommand: "2.AAAA|AAAA|AAAA",
      })) as DDGHandshakeResponse;

      expect(second.payload).toEqual({ error: DDGError.CannotDecrypt });
      expect(host.confirmPairing).toHaveBeenCalledTimes(1);

      answer!(true);
      await first;
    });

    it("the responder refuses a command while unpaired", async () => {
      expect(responder.currentState).toBe(ResponderState.Unpaired);

      const response = (await responder.handle({
        version: 1,
        messageId: "1",
        encryptedCommand: "2.AAAA|AAAA|AAAA",
      })) as DDGHandshakeResponse;

      expect(response.payload).toEqual({ error: DDGError.CannotDecrypt });
      expect(host.runCommand).not.toHaveBeenCalled();
    });
  });

  it("rejects a version it does not speak, without changing state", async () => {
    const handshake = { ...initiator.startHandshake(), version: 2 };

    const response = (await responder.handle(handshake)) as DDGHandshakeResponse;

    expect(response.payload).toEqual({ error: DDGError.VersionDiscrepancy });
    expect(responder.currentState).toBe(ResponderState.Unpaired);
    expect(host.confirmPairing).not.toHaveBeenCalled();
  });

  it("rejects a tampered message and stays paired", async () => {
    await pair();

    const request = initiator.sendCommand("bw-status");
    const [envelope, data, mac] = request.encryptedCommand.split("|");

    // Flip a bit in the MAC itself. Editing the base64 would not do: the final character of a
    // 32-byte MAC carries two bits that decode to nothing, so some edits change no byte at all.
    const flipped = Utils.fromB64ToArray(mac);
    flipped[0] ^= 0xff;
    const tampered = {
      ...request,
      encryptedCommand: [envelope, data, Utils.fromBufferToB64(flipped)].join("|"),
    };

    const response = (await responder.handle(tampered)) as DDGHandshakeResponse;

    expect(response.payload).toEqual({ error: DDGError.CannotDecrypt });
    expect(responder.currentState).toBe(ResponderState.Paired);
    expect(host.runCommand).not.toHaveBeenCalled();
  });

  it("re-pairs on a second handshake, retiring the previous session key", async () => {
    await pair();
    const beforeRepair = initiator.sendCommand("bw-status");

    // A second handshake from any peer replaces the session; nothing identifies the first.
    const second = new DuckDuckGoInitiator("Someone else");
    const secondHandshake = second.startHandshake();
    await responder.handle(secondHandshake);

    expect(host.confirmPairing).toHaveBeenCalledTimes(2);
    expect(responder.currentState).toBe(ResponderState.Paired);

    // The first peer's message no longer opens, because a fresh key was generated.
    jest.mocked(host.runCommand).mockClear();
    const response = (await responder.handle(beforeRepair)) as DDGHandshakeResponse;
    expect(response.payload).toEqual({ error: DDGError.CannotDecrypt });
  });

  it("resumes a session from a stored key without re-prompting", async () => {
    const stored = DDGSessionKey.fromBytes(generatedKey(0));
    const resumed = new DuckDuckGoResponder(host);
    resumed.resume(stored);

    expect(resumed.currentState).toBe(ResponderState.Paired);

    const request = {
      version: 1,
      messageId: "1",
      encryptedCommand: encrypt(JSON.stringify({ command: "bw-status" }), stored, Padding.Zero),
    };
    await resumed.handle(request);

    expect(host.confirmPairing).not.toHaveBeenCalled();
    expect(host.runCommand).toHaveBeenCalledWith({ command: "bw-status", payload: undefined });
  });
});

describe("the DuckDuckGo encstring format", () => {
  const key = DDGSessionKey.fromBytes(new Uint8Array(64));

  it("round-trips its own output in both paddings", () => {
    for (const padding of [Padding.Zero, Padding.Pkcs7]) {
      expect(decrypt(encrypt("Hello world", key, padding), key, padding)).toBe("Hello world");
    }
  });

  it("leaves a zero-padded block-aligned plaintext whole", () => {
    // 16 bytes ending in "0": forge's own unpad would read 0x30 as a count and drop 48 bytes.
    const exactlyOneBlock = "abcdefghijklmno0";

    expect(decrypt(encrypt(exactlyOneBlock, key, Padding.Zero), key, Padding.Zero)).toBe(
      exactlyOneBlock,
    );
  });
});
