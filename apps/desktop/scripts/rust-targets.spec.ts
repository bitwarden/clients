import {
  RUST_TARGETS,
  asHostPlatform,
  asNodeArch,
  binaryFileName,
  builtLibraryName,
  libraryFileName,
  buildEnv,
  crossCompilationPlan,
  cargoBuildCommand,
  cargoTargetArg,
  isCrossPlatform,
  rustTargetsFor,
} from "./rust-targets.mts";

describe("rustTargetsFor", () => {
  it("expands a universal macOS build into both architectures", () => {
    expect(rustTargetsFor("macos", ["universal"])).toEqual([
      "x86_64-apple-darwin",
      "aarch64-apple-darwin",
    ]);
  });

  it("maps a single architecture to a single triple", () => {
    expect(rustTargetsFor("macos", ["arm64"])).toEqual(["aarch64-apple-darwin"]);
    expect(rustTargetsFor("windows", ["ia32"])).toEqual(["i686-pc-windows-msvc"]);
    expect(rustTargetsFor("linux", ["x64"])).toEqual(["x86_64-unknown-linux-gnu"]);
  });

  it("does not repeat a triple that universal and an explicit architecture both ask for", () => {
    expect(rustTargetsFor("macos", ["universal", "arm64"])).toEqual([
      "x86_64-apple-darwin",
      "aarch64-apple-darwin",
    ]);
  });

  it("ignores architectures the platform does not have", () => {
    expect(rustTargetsFor("macos", ["ia32"])).toEqual([]);
  });

  it("covers every architecture the configuration can name", () => {
    expect(rustTargetsFor("windows", ["ia32", "x64", "arm64"])).toHaveLength(3);
    expect(rustTargetsFor("linux", ["x64", "arm64"])).toHaveLength(2);
  });
});

describe("binaryFileName", () => {
  it("names files the way the electron-builder templates expect", () => {
    expect(binaryFileName("desktop_proxy", "aarch64-apple-darwin")).toBe(
      "desktop_proxy.darwin-arm64",
    );
    expect(binaryFileName("desktop_proxy", "x86_64-unknown-linux-gnu")).toBe(
      "desktop_proxy.linux-x64",
    );
  });

  it("adds .exe for Windows targets", () => {
    expect(binaryFileName("windows_plugin_authenticator", "x86_64-pc-windows-msvc")).toBe(
      "windows_plugin_authenticator.win32-x64.exe",
    );
  });
});

describe("library naming", () => {
  it("keeps the name cargo emits separate from the staged one", () => {
    expect(builtLibraryName("process_isolation", "x86_64-unknown-linux-gnu")).toBe(
      "libprocess_isolation.so",
    );
    expect(libraryFileName("process_isolation", "x86_64-unknown-linux-gnu")).toBe(
      "libprocess_isolation.linux-x64.so",
    );
  });

  it("distinguishes architectures that share a staging directory", () => {
    expect(libraryFileName("process_isolation", "aarch64-unknown-linux-gnu")).toBe(
      "libprocess_isolation.linux-arm64.so",
    );
  });

  it("uses each platform's own library convention", () => {
    expect(builtLibraryName("process_isolation", "aarch64-apple-darwin")).toBe(
      "libprocess_isolation.dylib",
    );
    expect(builtLibraryName("process_isolation", "x86_64-pc-windows-msvc")).toBe(
      "process_isolation.dll",
    );
  });
});

describe("isCrossPlatform", () => {
  it("counts a different platform, but not a different architecture", () => {
    expect(isCrossPlatform("darwin", "x86_64-pc-windows-msvc")).toBe(true);
    expect(isCrossPlatform("darwin", "x86_64-apple-darwin")).toBe(false);
    expect(isCrossPlatform("linux", "aarch64-unknown-linux-gnu")).toBe(false);
  });
});

describe("crossCompilationPlan", () => {
  it("needs nothing beyond the rust targets when building for the host platform", () => {
    const plan = crossCompilationPlan("darwin", ["x86_64-apple-darwin", "aarch64-apple-darwin"]);

    expect(plan.tools).toEqual([]);
    expect(plan.unsupported).toEqual([]);
    expect(plan.targets).toHaveLength(2);
  });

  it("requires cargo-xwin and clang to build for Windows elsewhere", () => {
    const plan = crossCompilationPlan("darwin", ["x86_64-pc-windows-msvc"]);

    expect(plan.tools.map((tool) => tool.tool)).toEqual(["cargo-xwin", "clang"]);
    expect(plan.tools[0]).toMatchObject({
      pinnedAs: "cargo-xwin",
      install: expect.stringContaining("{version}"),
    });
    expect(plan.unsupported).toEqual([]);
  });

  it("requires nothing extra to build for Windows on Windows", () => {
    expect(crossCompilationPlan("win32", ["x86_64-pc-windows-msvc"]).tools).toEqual([]);
  });

  it("reports each tool once across several triples", () => {
    const plan = crossCompilationPlan("linux", [
      "x86_64-pc-windows-msvc",
      "aarch64-pc-windows-msvc",
    ]);

    expect(plan.tools.map((tool) => tool.tool)).toEqual(["cargo-xwin", "clang"]);
  });

  it("requires cargo-zigbuild and zig to build for Linux elsewhere", () => {
    const plan = crossCompilationPlan("darwin", ["x86_64-unknown-linux-gnu"]);

    expect(plan.tools.map((tool) => tool.tool)).toEqual(["cargo-zigbuild", "zig"]);
    expect(plan.unsupported).toEqual([]);
  });

  it("requires nothing extra to build for Linux on Linux", () => {
    expect(crossCompilationPlan("linux", ["x86_64-unknown-linux-gnu"]).tools).toEqual([]);
  });

  it("refuses to plan a macOS build from another platform", () => {
    expect(crossCompilationPlan("linux", ["aarch64-apple-darwin"]).unsupported).toEqual([
      expect.stringContaining("Apple's SDK"),
    ]);
  });

  it("never treats a cross build as needing nothing", () => {
    for (const host of ["darwin", "win32", "linux"] as const) {
      for (const target of Object.keys(RUST_TARGETS) as (keyof typeof RUST_TARGETS)[]) {
        const plan = crossCompilationPlan(host, [target]);
        const isCross = RUST_TARGETS[target].nodePlatform !== host;
        const hasVerdict = plan.tools.length > 0 || plan.unsupported.length > 0;

        expect({ host, target, hasVerdict }).toEqual({ host, target, hasVerdict: isCross });
      }
    }
  });
});

describe("buildEnv", () => {
  it("points cargo-xwin at clang when targeting Windows from elsewhere", () => {
    expect(buildEnv("darwin", "arm64", "x86_64-pc-windows-msvc")).toEqual({
      XWIN_CROSS_COMPILER: "clang",
    });
  });

  it("adds nothing when targeting Windows on Windows", () => {
    expect(buildEnv("win32", "x64", "x86_64-pc-windows-msvc")).toEqual({});
  });

  it("allows cross pkg-config only when the Linux build really is cross", () => {
    expect(buildEnv("linux", "x64", "aarch64-unknown-linux-gnu")).toEqual({
      PKG_CONFIG_ALLOW_CROSS: "1",
      PKG_CONFIG_ALL_STATIC: "1",
    });
    expect(buildEnv("linux", "x64", "x86_64-unknown-linux-gnu")).toEqual({});
  });

  it("adds nothing for a native macOS build", () => {
    expect(buildEnv("darwin", "arm64", "aarch64-apple-darwin")).toEqual({});
  });
});

describe("cargoBuildCommand", () => {
  it("uses plain cargo for the host's own platform", () => {
    expect(cargoBuildCommand("darwin", "aarch64-apple-darwin")).toEqual(["build"]);
    expect(cargoBuildCommand("win32", "x86_64-pc-windows-msvc")).toEqual(["build"]);
    expect(cargoBuildCommand("linux", "x86_64-unknown-linux-gnu")).toEqual(["build"]);
  });

  it("wraps build with cargo-xwin for Windows from elsewhere", () => {
    expect(cargoBuildCommand("darwin", "x86_64-pc-windows-msvc")).toEqual(["xwin", "build"]);
  });

  it("replaces build with cargo-zigbuild for Linux from elsewhere", () => {
    expect(cargoBuildCommand("darwin", "x86_64-unknown-linux-gnu")).toEqual(["zigbuild"]);
    expect(cargoBuildCommand("win32", "aarch64-unknown-linux-gnu")).toEqual(["zigbuild"]);
  });
});

describe("cargoTargetArg", () => {
  it("appends the glibc version only where cargo-zigbuild can use it", () => {
    expect(cargoTargetArg("darwin", "x86_64-unknown-linux-gnu", "2.35")).toBe(
      "x86_64-unknown-linux-gnu.2.35",
    );
    expect(cargoTargetArg("linux", "x86_64-unknown-linux-gnu", "2.35")).toBe(
      "x86_64-unknown-linux-gnu",
    );
    expect(cargoTargetArg("darwin", "x86_64-pc-windows-msvc", "2.35")).toBe(
      "x86_64-pc-windows-msvc",
    );
  });

  it("passes the plain triple when no glibc floor is configured", () => {
    expect(cargoTargetArg("darwin", "x86_64-unknown-linux-gnu", undefined)).toBe(
      "x86_64-unknown-linux-gnu",
    );
  });
});

describe("host detection", () => {
  it("accepts the platforms and architectures we build on", () => {
    expect(asHostPlatform("darwin")).toBe("darwin");
    expect(asHostPlatform("freebsd")).toBeUndefined();
    expect(asNodeArch("arm64")).toBe("arm64");
    expect(asNodeArch("ppc64")).toBeUndefined();
  });
});
