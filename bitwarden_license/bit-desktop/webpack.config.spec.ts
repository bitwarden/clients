import * as path from "path";

import { webpack } from "webpack";

// The env config loader's optional-file fallback does not work under Jest, and env values do not
// affect module resolution.
jest.mock("../../apps/desktop/config/config", () => ({ load: () => ({}), log: () => {} }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const buildCommercialConfigs = require("./webpack.config");

const commercialSdkDir = path.resolve(
  __dirname,
  "../../node_modules/@bitwarden/commercial-sdk-internal",
);
const importerDir = path.resolve(__dirname, "../../apps/desktop/src/services");

function resolveSdkRequest(bundleName: string, request: string): Promise<string> {
  const config = buildCommercialConfigs().find((c: { name: string }) => c.name === bundleName);
  const resolver = webpack({ ...config, mode: "production" }).resolverFactory.get("normal");
  return new Promise((resolve, reject) =>
    resolver.resolve({}, importerDir, request, {}, (err, result) =>
      err ? reject(err) : resolve(result as string),
    ),
  );
}

describe("commercial desktop webpack config", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(["main", "renderer", "preload"])(
    "resolves @bitwarden/sdk-internal to the commercial SDK in the %s bundle",
    async (bundleName) => {
      const resolved = await resolveSdkRequest(bundleName, "@bitwarden/sdk-internal");

      expect(resolved.startsWith(commercialSdkDir + path.sep)).toBe(true);
    },
  );

  it.each(["main", "renderer", "preload"])(
    "resolves the SDK wasm module to the commercial SDK in the %s bundle",
    async (bundleName) => {
      const resolved = await resolveSdkRequest(
        bundleName,
        "@bitwarden/sdk-internal/bitwarden_wasm_internal_bg.wasm",
      );

      expect(resolved).toBe(path.join(commercialSdkDir, "bitwarden_wasm_internal_bg.wasm"));
    },
  );
});
