import { Page } from "@playwright/test";

import {
  CreateRequest,
  GetRequest,
  SoftwareAuthenticator,
} from "../webauthn/software-authenticator";

const CREATE_BINDING = "__e2eSoftwareAuthenticatorCreate";
const GET_BINDING = "__e2eSoftwareAuthenticatorGet";

/**
 * Answers `navigator.credentials` in `page`, and its frames, with `authenticator`, so that
 * credentials registered on the web vault can later be used by another client. Must be called
 * before the page navigates.
 *
 * The answers have the real `PublicKeyCredential` prototypes, so `instanceof` checks pass.
 */
export async function useSoftwareAuthenticator(page: Page, authenticator: SoftwareAuthenticator) {
  await page.exposeBinding(CREATE_BINDING, (_source, request: CreateRequest) =>
    authenticator.create(request),
  );
  await page.exposeBinding(GET_BINDING, (_source, request: GetRequest) =>
    authenticator.get(request),
  );

  await page.addInitScript(
    ([createBinding, getBinding]) => {
      const toB64 = (source: BufferSource) => {
        const bytes = ArrayBuffer.isView(source)
          ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
          : new Uint8Array(source);
        let binary = "";
        bytes.forEach((b) => (binary += String.fromCharCode(b)));
        return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      };
      const fromB64 = (value: string) => {
        const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
        return Uint8Array.from(binary, (c) => c.charCodeAt(0)).buffer;
      };
      const withValues = <T extends object>(target: T, values: Record<string, unknown>): T => {
        for (const [key, value] of Object.entries(values)) {
          Object.defineProperty(target, key, { value, enumerable: true });
        }
        return target;
      };
      type Prf = { first: string; second?: string };
      const prfInputs = (extensions: any): Prf | undefined => {
        const inputs = extensions?.prf?.eval;
        return inputs == null
          ? undefined
          : {
              first: toB64(inputs.first),
              second: inputs.second == null ? undefined : toB64(inputs.second),
            };
      };
      const prfResults = (prf: Prf | undefined) =>
        prf == null
          ? undefined
          : {
              first: fromB64(prf.first),
              ...(prf.second == null ? {} : { second: fromB64(prf.second) }),
            };
      const bindings = window as any;

      navigator.credentials.create = async (options?: CredentialCreationOptions) => {
        const publicKey = options!.publicKey!;
        const result = await bindings[createBinding]({
          origin: location.origin,
          rpId: publicKey.rp.id ?? location.hostname,
          challenge: toB64(publicKey.challenge),
          userId: toB64(publicKey.user.id),
          prf: prfInputs(publicKey.extensions),
        });
        const response = withValues(Object.create(AuthenticatorAttestationResponse.prototype), {
          clientDataJSON: fromB64(result.clientDataJson),
          attestationObject: fromB64(result.attestationObject),
          getTransports: () => result.transports,
        });
        const extensionResults =
          (publicKey.extensions as any)?.prf == null
            ? {}
            : { prf: { enabled: true, results: prfResults(result.prf) } };
        return withValues(Object.create(PublicKeyCredential.prototype), {
          id: result.credentialId,
          rawId: fromB64(result.credentialId),
          type: "public-key",
          authenticatorAttachment: "platform",
          response,
          getClientExtensionResults: () => extensionResults,
        });
      };

      navigator.credentials.get = async (options?: CredentialRequestOptions) => {
        const publicKey = options!.publicKey!;
        const result = await bindings[getBinding]({
          origin: location.origin,
          rpId: publicKey.rpId ?? location.hostname,
          challenge: toB64(publicKey.challenge),
          allowCredentials: (publicKey.allowCredentials ?? []).map((c) => ({ id: toB64(c.id) })),
          prf: prfInputs(publicKey.extensions),
        });
        const response = withValues(Object.create(AuthenticatorAssertionResponse.prototype), {
          clientDataJSON: fromB64(result.clientDataJson),
          authenticatorData: fromB64(result.authenticatorData),
          signature: fromB64(result.signature),
          userHandle: fromB64(result.userHandle),
        });
        const extensionResults =
          (publicKey.extensions as any)?.prf == null
            ? {}
            : { prf: { results: prfResults(result.prf) } };
        return withValues(Object.create(PublicKeyCredential.prototype), {
          id: result.credentialId,
          rawId: fromB64(result.credentialId),
          type: "public-key",
          authenticatorAttachment: result.authenticatorAttachment,
          response,
          getClientExtensionResults: () => extensionResults,
        });
      };
    },
    [CREATE_BINDING, GET_BINDING] as const,
  );
}
