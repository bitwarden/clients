/* tslint:disable */
 
/**
 * Generate a new Curve25519 keypair
 */
export function generate_keypair(): Keypair;
/**
 * Initialize the WASM module
 */
export function init(): void;
/**
 * Keypair structure
 */
export class Keypair {
  free(): void;
  [Symbol.dispose](): void;
  constructor(public_key: Uint8Array, secret_key: Uint8Array);
  readonly public_key: Uint8Array;
  readonly secret_key: Uint8Array;
}
/**
 * Noise Protocol state machine
 */
export class NoiseProtocol {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Read a handshake message from the peer
   * Returns the payload contained in the message
   */
  readMessage(message: Uint8Array): Uint8Array;
  /**
   * Write a handshake message
   * Returns the message to send to the peer
   */
  writeMessage(payload?: Uint8Array | null): Uint8Array;
  /**
   * Decrypt a message (after handshake is complete)
   */
  decryptMessage(ciphertext: Uint8Array): Uint8Array;
  /**
   * Encrypt a message (after handshake is complete)
   */
  encryptMessage(plaintext: Uint8Array): Uint8Array;
  /**
   * Check if handshake is complete
   */
  isHandshakeComplete(): boolean;
  /**
   * Get the remote static public key (available after handshake)
   */
  getRemoteStaticPublicKey(): Uint8Array;
  /**
   * Create a new Noise protocol instance
   *
   * # Arguments
   * * `is_initiator` - Whether this is the initiator (true) or responder (false)
   * * `static_keypair` - Optional static keypair (if None, generates new one)
   * * `psk` - Optional pre-shared key for additional authentication
   */
  constructor(
    is_initiator: boolean,
    static_secret_key?: Uint8Array | null,
    psk?: Uint8Array | null,
  );
  /**
   * Complete the handshake and derive transport keys
   */
  split(): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_keypair_free: (a: number, b: number) => void;
  readonly __wbg_noiseprotocol_free: (a: number, b: number) => void;
  readonly generate_keypair: (a: number) => void;
  readonly init: () => void;
  readonly keypair_new: (a: number, b: number, c: number, d: number) => number;
  readonly keypair_public_key: (a: number, b: number) => void;
  readonly keypair_secret_key: (a: number, b: number) => void;
  readonly noiseprotocol_decryptMessage: (a: number, b: number, c: number, d: number) => void;
  readonly noiseprotocol_encryptMessage: (a: number, b: number, c: number, d: number) => void;
  readonly noiseprotocol_getRemoteStaticPublicKey: (a: number, b: number) => void;
  readonly noiseprotocol_isHandshakeComplete: (a: number) => number;
  readonly noiseprotocol_new: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ) => void;
  readonly noiseprotocol_readMessage: (a: number, b: number, c: number, d: number) => void;
  readonly noiseprotocol_split: (a: number, b: number) => void;
  readonly noiseprotocol_writeMessage: (a: number, b: number, c: number, d: number) => void;
  readonly __wbindgen_export: (a: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_export2: (a: number, b: number) => number;
  readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init(
  module_or_path?:
    | { module_or_path: InitInput | Promise<InitInput> }
    | InitInput
    | Promise<InitInput>,
): Promise<InitOutput>;
