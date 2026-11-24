/**
 * Generates the plaintext agent-access pre-shared key (PSK) for a new agent connection.
 *
 * The real implementation is owned by the agent-access library (out of scope here); this seam lets
 * the OAuth broker flow be built and tested before that library lands. The returned PSK is
 * Protected Data: it is wrapped under the user key before it leaves the client and is never sent to
 * the server in plaintext.
 */
export abstract class AgentAccessPskGenerator {
  abstract generate(): Promise<string>;
}
