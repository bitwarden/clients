import { IframeAllowCacheBackground } from "./iframe-allow-cache.background";
import { PermissionsPolicyHeaderCacheBackground } from "./permissions-policy-header-cache.background";
import { NoOpPermissionsPolicyParser, PermissionsPolicyParser } from "./permissions-policy-parser";
import {
  ParsedPermissionsPolicy,
  PermissionsPolicyDirective,
  ResolvedAllowlistItem,
  ResolvedPermissionsPolicy,
  WebAuthnPermissionsPolicyFeature,
} from "./types";
import { WebAuthnPermissionsPolicyBackground } from "./webauthn-permissions-policy.background";

const TAB = 1;
const TOP_FRAME_ID = 0;
const CHILD_FRAME_ID = 5;
const TOP_URL = "https://parent.example/";
const CHILD_URL = "https://child.example/";
const TOP_ORIGIN = "https://parent.example";
const CHILD_ORIGIN = "https://child.example";

// Unresolved policy — may contain `{ type: "self" }` items. Use for
// `parseHeader` outputs, which are what `resolveSelfInPolicy` consumes.
function policyOf(...directives: PermissionsPolicyDirective[]): ParsedPermissionsPolicy {
  return new Map(directives.map((d) => [d.feature, d]));
}

// Resolved policy — no `{ type: "self" }` items. Use for
// `parseAllowAttribute` outputs (which the parser resolves at parse time)
// and for any input to the resolver.
function resolvedPolicyOf(
  ...directives: PermissionsPolicyDirective<ResolvedAllowlistItem>[]
): ResolvedPermissionsPolicy {
  return new Map(directives.map((d) => [d.feature, d]));
}

type FrameDetail = chrome.webNavigation.GetAllFrameResultDetails;

function frame(frameId: number, url: string, parentFrameId: number = -1): FrameDetail {
  return { frameId, parentFrameId, url, errorOccurred: false } as FrameDetail;
}

/**
 * Test parser that lets each test inject the parsed shapes it wants the
 * resolver to see. Keyed by raw input string.
 */
function makeTestParser(
  headers: Record<string, ParsedPermissionsPolicy> = {},
  attributes: Record<string, ResolvedPermissionsPolicy> = {},
): PermissionsPolicyParser {
  return {
    parseHeader: (raw) => headers[raw] ?? new Map(),
    parseAllowAttribute: (raw) => attributes[raw] ?? new Map(),
  };
}

function makeHeaderCache(initial: Record<string, string> = {}) {
  return {
    getRawHeader: jest.fn((tabId: number, frameId: number) => initial[`${tabId}:${frameId}`]),
  } as unknown as PermissionsPolicyHeaderCacheBackground;
}

function makeIframeAllowCache(initial: Record<string, string> = {}) {
  return {
    getAllowForChildFrame: jest.fn(
      (tabId: number, parentFrameId: number, childUrl: string) =>
        initial[`${tabId}:${parentFrameId}:${childUrl}`],
    ),
  } as unknown as IframeAllowCacheBackground;
}

function makeWebNavigation(frames: FrameDetail[] | null | Error) {
  return {
    getAllFrames: jest.fn(
      (
        _details: chrome.webNavigation.GetFrameDetails,
        callback: (result?: FrameDetail[]) => void,
      ) => {
        if (frames instanceof Error) {
          throw frames;
        }
        callback(frames ?? undefined);
      },
    ),
  } as unknown as typeof chrome.webNavigation;
}

describe("WebAuthnPermissionsPolicyBackground", () => {
  describe("fail-open paths (defensive defaults)", () => {
    it("returns true when getAllFrames returns null", async () => {
      const helper = new WebAuthnPermissionsPolicyBackground(
        makeHeaderCache(),
        makeIframeAllowCache(),
        makeWebNavigation(null),
        new NoOpPermissionsPolicyParser(),
      );

      await expect(
        helper.isFeatureAllowedForFrame(TAB, TOP_FRAME_ID, WebAuthnPermissionsPolicyFeature.Get),
      ).resolves.toBe(true);
    });

    it("returns true when getAllFrames throws", async () => {
      const helper = new WebAuthnPermissionsPolicyBackground(
        makeHeaderCache(),
        makeIframeAllowCache(),
        makeWebNavigation(new Error("boom")),
        new NoOpPermissionsPolicyParser(),
      );

      await expect(
        helper.isFeatureAllowedForFrame(TAB, TOP_FRAME_ID, WebAuthnPermissionsPolicyFeature.Get),
      ).resolves.toBe(true);
    });

    it("returns true when the requesting frame isn't in the tree", async () => {
      const helper = new WebAuthnPermissionsPolicyBackground(
        makeHeaderCache(),
        makeIframeAllowCache(),
        makeWebNavigation([frame(TOP_FRAME_ID, TOP_URL)]),
        new NoOpPermissionsPolicyParser(),
      );

      await expect(
        helper.isFeatureAllowedForFrame(TAB, 999, WebAuthnPermissionsPolicyFeature.Get),
      ).resolves.toBe(true);
    });

    it("returns true when the requesting frame's URL can't be parsed", async () => {
      const helper = new WebAuthnPermissionsPolicyBackground(
        makeHeaderCache(),
        makeIframeAllowCache(),
        makeWebNavigation([frame(TOP_FRAME_ID, "not a url")]),
        new NoOpPermissionsPolicyParser(),
      );

      await expect(
        helper.isFeatureAllowedForFrame(TAB, TOP_FRAME_ID, WebAuthnPermissionsPolicyFeature.Get),
      ).resolves.toBe(true);
    });
  });

  describe("top-level frame", () => {
    it("permits the feature when no header was cached (no-op parser)", async () => {
      const helper = new WebAuthnPermissionsPolicyBackground(
        makeHeaderCache(),
        makeIframeAllowCache(),
        makeWebNavigation([frame(TOP_FRAME_ID, TOP_URL)]),
        new NoOpPermissionsPolicyParser(),
      );

      await expect(
        helper.isFeatureAllowedForFrame(TAB, TOP_FRAME_ID, WebAuthnPermissionsPolicyFeature.Get),
      ).resolves.toBe(true);
    });

    it("denies the feature when the parser reports an empty allowlist for it", async () => {
      const rawHeader = "publickey-credentials-get=()";
      const parser = makeTestParser({
        [rawHeader]: policyOf({
          feature: WebAuthnPermissionsPolicyFeature.Get,
          allowlist: [],
        }),
      });
      const helper = new WebAuthnPermissionsPolicyBackground(
        makeHeaderCache({ [`${TAB}:${TOP_FRAME_ID}`]: rawHeader }),
        makeIframeAllowCache(),
        makeWebNavigation([frame(TOP_FRAME_ID, TOP_URL)]),
        parser,
      );

      await expect(
        helper.isFeatureAllowedForFrame(TAB, TOP_FRAME_ID, WebAuthnPermissionsPolicyFeature.Get),
      ).resolves.toBe(false);
    });
  });

  describe("cross-origin iframe (VULN-398 / VULN-582)", () => {
    const childFrame = frame(CHILD_FRAME_ID, CHILD_URL, TOP_FRAME_ID);
    const topFrame = frame(TOP_FRAME_ID, TOP_URL);

    it("denies a cross-origin iframe with no `allow=` (VULN-398 primary)", async () => {
      const helper = new WebAuthnPermissionsPolicyBackground(
        makeHeaderCache(),
        makeIframeAllowCache(),
        makeWebNavigation([topFrame, childFrame]),
        new NoOpPermissionsPolicyParser(),
      );

      await expect(
        helper.isFeatureAllowedForFrame(TAB, CHILD_FRAME_ID, WebAuthnPermissionsPolicyFeature.Get),
      ).resolves.toBe(false);
    });

    it("permits a cross-origin iframe when the parser parses `allow=` to delegate to the iframe origin", async () => {
      const rawAllow = "publickey-credentials-get";
      const parser = makeTestParser(
        {},
        {
          [rawAllow]: resolvedPolicyOf({
            feature: WebAuthnPermissionsPolicyFeature.Get,
            allowlist: [{ type: "origin", value: CHILD_ORIGIN }],
          }),
        },
      );
      const helper = new WebAuthnPermissionsPolicyBackground(
        makeHeaderCache(),
        makeIframeAllowCache({
          [`${TAB}:${TOP_FRAME_ID}:${CHILD_URL}`]: rawAllow,
        }),
        makeWebNavigation([topFrame, childFrame]),
        parser,
      );

      await expect(
        helper.isFeatureAllowedForFrame(TAB, CHILD_FRAME_ID, WebAuthnPermissionsPolicyFeature.Get),
      ).resolves.toBe(true);
    });

    it("denies a cross-origin iframe when the parent header explicitly denies (VULN-582 cross-origin)", async () => {
      const rawParentHeader = "publickey-credentials-get=()";
      const rawAllow = "publickey-credentials-get";
      const parser = makeTestParser(
        {
          [rawParentHeader]: policyOf({
            feature: WebAuthnPermissionsPolicyFeature.Get,
            allowlist: [],
          }),
        },
        {
          [rawAllow]: resolvedPolicyOf({
            feature: WebAuthnPermissionsPolicyFeature.Get,
            allowlist: [{ type: "origin", value: CHILD_ORIGIN }],
          }),
        },
      );
      const helper = new WebAuthnPermissionsPolicyBackground(
        makeHeaderCache({ [`${TAB}:${TOP_FRAME_ID}`]: rawParentHeader }),
        makeIframeAllowCache({
          [`${TAB}:${TOP_FRAME_ID}:${CHILD_URL}`]: rawAllow,
        }),
        makeWebNavigation([topFrame, childFrame]),
        parser,
      );

      await expect(
        helper.isFeatureAllowedForFrame(TAB, CHILD_FRAME_ID, WebAuthnPermissionsPolicyFeature.Get),
      ).resolves.toBe(false);
    });

    it("passes the correct origins to parseAllowAttribute (iframe origin + parent origin)", async () => {
      const rawAllow = "publickey-credentials-get";
      const parser = makeTestParser(
        {},
        {
          [rawAllow]: resolvedPolicyOf({
            feature: WebAuthnPermissionsPolicyFeature.Get,
            allowlist: [{ type: "origin", value: CHILD_ORIGIN }],
          }),
        },
      );
      const parseAllowAttributeSpy = jest.spyOn(parser, "parseAllowAttribute");
      const helper = new WebAuthnPermissionsPolicyBackground(
        makeHeaderCache(),
        makeIframeAllowCache({
          [`${TAB}:${TOP_FRAME_ID}:${CHILD_URL}`]: rawAllow,
        }),
        makeWebNavigation([topFrame, childFrame]),
        parser,
      );

      await helper.isFeatureAllowedForFrame(
        TAB,
        CHILD_FRAME_ID,
        WebAuthnPermissionsPolicyFeature.Get,
      );

      expect(parseAllowAttributeSpy).toHaveBeenCalledWith(rawAllow, CHILD_ORIGIN, TOP_ORIGIN);
    });
  });

  describe("ancestor `self`-only header restricts a cross-origin descendant (regression)", () => {
    // Trace from AI-reviewer feedback (reviewer thread on
    // `permissions-policy-semantics.ts:89`): if `{ type: 'self' }` matches any
    // requesting origin, an ancestor's declared `feature=self` header fails to
    // restrict cross-origin descendants that would otherwise pass container
    // checks. Resolving `self` to the declaring frame's own origin in
    // `buildFrameNode` closes the leak.
    it("denies when middle's declared header is `self` and the request comes from a cross-origin descendant", async () => {
      const TOP_URL = "https://top.example/";
      const MIDDLE_URL = "https://middle.example/";
      const INNER_URL = "https://inner.example/";

      // Middle emits `publickey-credentials-get=self`.
      const middleHeader = "publickey-credentials-get=self";
      // Middle's iframe on inner grants everyone; top's iframe on middle also.
      const wildcardAllow = "publickey-credentials-get *";

      const parser: PermissionsPolicyParser = {
        parseHeader: (raw) =>
          raw === middleHeader
            ? policyOf({
                feature: WebAuthnPermissionsPolicyFeature.Get,
                allowlist: [{ type: "self" }],
              })
            : new Map(),
        parseAllowAttribute: (raw) =>
          raw === wildcardAllow
            ? resolvedPolicyOf({
                feature: WebAuthnPermissionsPolicyFeature.Get,
                allowlist: [{ type: "wildcard" }],
              })
            : new Map(),
      };

      const helper = new WebAuthnPermissionsPolicyBackground(
        makeHeaderCache({
          [`${TAB}:1`]: middleHeader, // middle's declared header
        }),
        makeIframeAllowCache({
          // top's `allow=` on the middle iframe:
          [`${TAB}:0:${MIDDLE_URL}`]: wildcardAllow,
          // middle's `allow=` on the inner iframe:
          [`${TAB}:1:${INNER_URL}`]: wildcardAllow,
        }),
        makeWebNavigation([frame(0, TOP_URL, -1), frame(1, MIDDLE_URL, 0), frame(2, INNER_URL, 1)]),
        parser,
      );

      // With the bug present, the check would return true because
      // `allowlistMatches([{self}], INNER_ORIGIN)` returned true. With the fix,
      // middle's `[{self}]` resolves to `[{origin: MIDDLE_ORIGIN}]` at build
      // time, and that doesn't match INNER_ORIGIN — so the ceremony is denied.
      await expect(
        helper.isFeatureAllowedForFrame(TAB, 2, WebAuthnPermissionsPolicyFeature.Get),
      ).resolves.toBe(false);

      // Sanity: middle's own use of the same feature is still permitted by
      // its `self` header — `self` resolves to middle's origin, which matches
      // when the requesting frame is middle itself.
      await expect(
        helper.isFeatureAllowedForFrame(TAB, 1, WebAuthnPermissionsPolicyFeature.Get),
      ).resolves.toBe(true);
    });
  });

  describe("no-op parser (resolver-only behavior)", () => {
    it("all declared/allow inputs parse to empty policies", async () => {
      // Top-level frame, header present, no-op parser → resolver sees empty
      // declared policy, falls back to spec default (wildcard) → allowed.
      const helper = new WebAuthnPermissionsPolicyBackground(
        makeHeaderCache({ [`${TAB}:${TOP_FRAME_ID}`]: "publickey-credentials-get=()" }),
        makeIframeAllowCache(),
        makeWebNavigation([frame(TOP_FRAME_ID, TOP_URL)]),
        new NoOpPermissionsPolicyParser(),
      );

      await expect(
        helper.isFeatureAllowedForFrame(TAB, TOP_FRAME_ID, WebAuthnPermissionsPolicyFeature.Get),
      ).resolves.toBe(true);
    });

    it("cross-origin iframe without `allow=` is still denied (VULN-398 closed via container default)", async () => {
      const childFrame = frame(CHILD_FRAME_ID, CHILD_URL, TOP_FRAME_ID);
      const helper = new WebAuthnPermissionsPolicyBackground(
        makeHeaderCache(),
        makeIframeAllowCache(),
        makeWebNavigation([frame(TOP_FRAME_ID, TOP_URL), childFrame]),
        new NoOpPermissionsPolicyParser(),
      );

      await expect(
        helper.isFeatureAllowedForFrame(TAB, CHILD_FRAME_ID, WebAuthnPermissionsPolicyFeature.Get),
      ).resolves.toBe(false);
    });
  });
});
