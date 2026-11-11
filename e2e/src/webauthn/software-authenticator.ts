import {
  createHash,
  createHmac,
  generateKeyPairSync,
  KeyObject,
  randomBytes,
  sign,
} from "node:crypto";

import { CborValue, encodeCbor } from "./cbor";

/** Bytes as base64url, how requests and responses cross the page and automation boundaries. */
export type B64 = string;

export function toB64(bytes: Uint8Array): B64 {
  return Buffer.from(bytes).toString("base64url");
}

export function fromB64(value: B64): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

/** PRF `eval` inputs or outputs. */
export type PrfValues = { first: B64; second?: B64 };

/** What a client asks to create a credential, after `navigator.credentials.create` options. */
export type CreateRequest = {
  origin: string;
  rpId: string;
  challenge: B64;
  userId: B64;
  prf?: PrfValues;
};

export type CreateResponse = {
  credentialId: B64;
  clientDataJson: B64;
  attestationObject: B64;
  transports: string[];
  prf?: PrfValues;
};

/** What a client asks to assert, after `navigator.credentials.get` options. */
export type GetRequest = {
  origin: string;
  rpId: string;
  challenge: B64;
  allowCredentials: { id: B64 }[];
  prf?: PrfValues;
};

export type GetResponse = {
  credentialId: B64;
  clientDataJson: B64;
  authenticatorData: B64;
  signature: B64;
  userHandle: B64;
  authenticatorAttachment: string;
  prf?: PrfValues;
};

type Credential = {
  id: Uint8Array;
  rpId: string;
  userHandle: Uint8Array;
  privateKey: KeyObject;
  prfSecret: Uint8Array;
  signCount: number;
};

// Flags in authenticator data: user present, user verified, attested credential data included.
const FLAG_UP = 0x01;
const FLAG_UV = 0x04;
const FLAG_AT = 0x40;

// Authenticators without attestation report an all-zero AAGUID.
const AAGUID = new Uint8Array(16);

const PRF_CONTEXT = new TextEncoder().encode("WebAuthn PRF\0");

function sha256(...parts: Uint8Array[]): Uint8Array {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(part);
  }
  return new Uint8Array(hash.digest());
}

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function clientData(type: string, request: { origin: string; challenge: B64 }): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      type,
      challenge: request.challenge,
      origin: request.origin,
      crossOrigin: false,
    }),
  );
}

/**
 * A discoverable, user-verifying passkey authenticator in the test process, with ES256 keys and
 * the PRF extension. Unlike a browser's virtual authenticator, its credentials can be used from
 * any client, e.g. registered on the web vault and asserted for the desktop app.
 *
 * It also plays the WebAuthn client: it builds the client data from the origin it's given.
 */
export class SoftwareAuthenticator {
  private credentials: Credential[] = [];

  create(request: CreateRequest): CreateResponse {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const credential: Credential = {
      id: new Uint8Array(randomBytes(32)),
      rpId: request.rpId,
      userHandle: fromB64(request.userId),
      privateKey,
      prfSecret: new Uint8Array(randomBytes(32)),
      signCount: 0,
    };
    this.credentials.push(credential);

    const jwk = publicKey.export({ format: "jwk" });
    const coseKey = encodeCbor(
      new Map<CborValue, CborValue>([
        [1, 2], // kty: EC2
        [3, -7], // alg: ES256
        [-1, 1], // crv: P-256
        [-2, fromB64(jwk.x!)],
        [-3, fromB64(jwk.y!)],
      ]),
    );
    const credentialIdLength = Uint8Array.of(
      credential.id.length >> 8,
      credential.id.length & 0xff,
    );
    const authenticatorData = Buffer.concat([
      sha256(new TextEncoder().encode(request.rpId)),
      Uint8Array.of(FLAG_UP | FLAG_UV | FLAG_AT),
      uint32(credential.signCount),
      AAGUID,
      credentialIdLength,
      credential.id,
      coseKey,
    ]);
    const attestationObject = encodeCbor(
      new Map<CborValue, CborValue>([
        ["fmt", "none"],
        ["attStmt", new Map<CborValue, CborValue>()],
        ["authData", new Uint8Array(authenticatorData)],
      ]),
    );

    return {
      credentialId: toB64(credential.id),
      clientDataJson: toB64(clientData("webauthn.create", request)),
      attestationObject: toB64(attestationObject),
      transports: ["internal"],
      prf: request.prf == null ? undefined : this.evaluatePrf(credential, request.prf),
    };
  }

  /** Asserts with a credential for the RP ID, one of `allowCredentials` if any are given. */
  get(request: GetRequest): GetResponse {
    const allowed = new Set(request.allowCredentials.map((c) => c.id));
    const credential = this.credentials.find(
      (c) => c.rpId === request.rpId && (allowed.size === 0 || allowed.has(toB64(c.id))),
    );
    if (credential == null) {
      throw new Error(`No credential for ${request.rpId}`);
    }

    credential.signCount++;
    const authenticatorData = Buffer.concat([
      sha256(new TextEncoder().encode(request.rpId)),
      Uint8Array.of(FLAG_UP | FLAG_UV),
      uint32(credential.signCount),
    ]);
    const clientDataJson = clientData("webauthn.get", request);
    const signature = sign("sha256", Buffer.concat([authenticatorData, sha256(clientDataJson)]), {
      key: credential.privateKey,
      dsaEncoding: "der",
    });

    return {
      credentialId: toB64(credential.id),
      clientDataJson: toB64(clientDataJson),
      authenticatorData: toB64(authenticatorData),
      signature: toB64(signature),
      userHandle: toB64(credential.userHandle),
      authenticatorAttachment: "platform",
      prf: request.prf == null ? undefined : this.evaluatePrf(credential, request.prf),
    };
  }

  /** The PRF extension's outputs: HMAC-SHA-256 over the salted input, as with `hmac-secret`. */
  private evaluatePrf(credential: Credential, inputs: PrfValues): PrfValues {
    const evaluate = (input: B64) =>
      toB64(
        createHmac("sha256", credential.prfSecret)
          .update(sha256(PRF_CONTEXT, fromB64(input)))
          .digest(),
      );
    return {
      first: evaluate(inputs.first),
      second: inputs.second == null ? undefined : evaluate(inputs.second),
    };
  }
}
