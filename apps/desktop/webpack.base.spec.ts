import { buildConfig } from "./webpack.base";

// Environment config is irrelevant to output paths, and its optional files break jest's resolver.
jest.mock("./config/config", () => ({ load: () => ({}), log: () => {} }));

const PARAMS = {
  configName: "Test",
  renderer: {
    entry: "renderer.ts",
    entryModule: "app.module#AppModule",
    tsConfig: "tsconfig.json",
  },
  main: { entry: "main.ts", tsConfig: "tsconfig.json" },
  preload: { entry: "preload.ts", tsConfig: "tsconfig.json" },
  outputPath: "/build",
};

// Webpack names async chunks with `chunkFilename`, falling back to `filename`.
function chunkFilename(output: { chunkFilename?: string; filename?: string }): string {
  return output.chunkFilename ?? output.filename;
}

describe("buildConfig", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  // Main and renderer share an output path and both lazy-load the SDK .wasm. Equal chunk
  // names make one overwrite the other, e.g. the renderer's web chunk breaking main
  // with "self is not defined".
  it("writes main and renderer async chunks to different files", () => {
    const configs = buildConfig(PARAMS);
    const main = configs.find((config) => config.name === "main");
    const renderer = configs.find((config) => config.name === "renderer");

    expect(main.output.path).toBe(renderer.output.path);
    expect(chunkFilename(main.output)).not.toBe(chunkFilename(renderer.output));
  });
});
