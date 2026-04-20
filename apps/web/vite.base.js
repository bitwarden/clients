// Parallel Vite dev-server factory for the web vault.
// Mirrors the buildConfig() shape from webpack.base.js so consumers (apps/web,
// bitwarden_license/bit-web) read the same way as their webpack counterparts.
//
// POC scope: dev server only. No production build target. No connector HTML
// entries. See /Users/oscar/.claude/plans/i-want-to-explore-enumerated-lightning.md

const fs = require("fs");
const path = require("path");

const config = require(path.resolve(__dirname, "config.js"));
const pjson = require(path.resolve(__dirname, "package.json"));

const REPO_ROOT = path.resolve(__dirname, "../..");
const VITE_ROOT = path.resolve(__dirname, "vite-root");

function buildDefines(envConfig, version, NODE_ENV, ENV) {
  // Mirrors webpack.EnvironmentPlugin in webpack.base.js. Each value must be
  // JSON.stringify'd because Vite's define performs textual substitution.
  const env = {
    ENV,
    NODE_ENV: NODE_ENV === "production" ? "production" : "development",
    APPLICATION_VERSION: pjson.version,
    CACHE_TAG: Math.random().toString(36).substring(7),
    URLS: envConfig.urls ?? {},
    STRIPE_KEY: envConfig.stripeKey ?? "",
    BRAINTREE_KEY: envConfig.braintreeKey ?? "",
    PAYPAL_CONFIG: envConfig.paypal ?? {},
    FLAGS: envConfig.flags ?? {},
    DEV_FLAGS: NODE_ENV === "development" ? (envConfig.devFlags ?? {}) : {},
    ADDITIONAL_REGIONS: envConfig.additionalRegions ?? [],
  };

  const defines = {};
  for (const [k, v] of Object.entries(env)) {
    defines[`process.env.${k}`] = JSON.stringify(v);
  }
  // Fallback so any un-enumerated process.env.X read returns undefined
  // instead of throwing at runtime (webpack's ProvidePlugin equivalent).
  defines["process.env"] = JSON.stringify(env);
  return defines;
}

function buildHttpsOptions() {
  const certSuffix = fs.existsSync(path.resolve(__dirname, "dev-server.local.pem"))
    ? ".local"
    : ".shared";
  const certPath = path.resolve(__dirname, "dev-server" + certSuffix + ".pem");
  return {
    key: fs.readFileSync(certPath),
    cert: fs.readFileSync(certPath),
  };
}

function buildProxy(envConfig) {
  const dev = envConfig.dev ?? {};
  const targets = {
    "/api": dev.proxyApi,
    "/identity": dev.proxyIdentity,
    "/events": dev.proxyEvents,
    "/notifications": dev.proxyNotifications,
    "/icons": dev.proxyIcons,
    "/key-connector": dev.proxyKeyConnector,
  };
  const proxy = {};
  for (const [prefix, target] of Object.entries(targets)) {
    if (!target) {
      continue;
    }
    proxy[prefix] = {
      target,
      changeOrigin: true,
      secure: false,
      ws: prefix === "/notifications",
      rewrite: (p) => p.replace(new RegExp(`^${prefix}`), ""),
    };
  }
  return proxy;
}

function buildCsp(envConfig) {
  // Ported from webpack.base.js dev server headers. WASM needs
  // 'wasm-unsafe-eval' for the SDK to instantiate.
  return `
    default-src 'self'
    ;script-src
    'self'
    'unsafe-inline'
    'unsafe-eval'
    'wasm-unsafe-eval'
    https://js.stripe.com
    https://js.braintreegateway.com
    https://www.paypalobjects.com
    ;style-src
    'self'
    'unsafe-inline'
    https://assets.braintreegateway.com
    https://*.paypal.com
    ;img-src
    'self'
    data:
    https://icons.bitwarden.net
    https://*.paypal.com
    https://www.paypalobjects.com
    https://q.stripe.com
    https://logos.haveibeenpwned.com
    ;media-src
    'self'
    https://assets.bitwarden.com
    ;child-src
    'self'
    https://js.stripe.com
    https://assets.braintreegateway.com
    https://*.paypal.com
    https://*.duosecurity.com
    ;frame-src
    'self'
    https://js.stripe.com
    https://assets.braintreegateway.com
    https://*.paypal.com
    https://*.duosecurity.com
    ;connect-src
    'self'
    ${envConfig.dev?.wsConnectSrc ?? ""}
    wss://notifications.bitwarden.com
    https://notifications.bitwarden.com
    https://cdn.bitwarden.net
    https://api.pwnedpasswords.com
    https://api.2fa.directory/v3/totp.json
    https://api.stripe.com
    https://www.paypal.com
    https://api.sandbox.braintreegateway.com
    https://api.braintreegateway.com
    https://client-analytics.braintreegateway.com
    https://*.braintree-api.com
    https://*.blob.core.windows.net
    http://127.0.0.1:10000
    https://app.simplelogin.io/api/alias/random/new
    https://quack.duckduckgo.com/api/email/addresses
    https://app.addy.io/api/v1/aliases
    https://api.fastmail.com
    https://api.forwardemail.net
    http://localhost:5000
    ws://localhost:* wss://localhost:*
    ;object-src
    'self'
    blob:
    ;`
    .replace(/\n/g, " ")
    .replace(/ +(?= )/g, "");
}

const DEFAULT_PARAMS = {
  outputPath: path.resolve(__dirname, "build"),
};

/**
 * @param {{
 *  configName: string;
 *  app: { entry: string; entryModule: string; };
 *  tsConfig: string;
 *  outputPath?: string;
 *  importAliases?: { name: string; alias: string }[];
 *  env?: { ENV?: string; NODE_ENV?: string; LOGGING?: boolean };
 * }} params
 * @returns {Promise<import("vite").UserConfig>}
 */
module.exports.buildConfig = async function buildConfig(params) {
  params = { ...DEFAULT_PARAMS, ...params };

  const ENV = params.env?.ENV ?? process.env.ENV ?? "development";
  const NODE_ENV = params.env?.NODE_ENV ?? process.env.NODE_ENV ?? "development";
  const LOGGING =
    params.env?.LOGGING ??
    (process.env.LOGGING === undefined ? true : process.env.LOGGING !== "false");

  const envConfig = config.load(ENV);
  if (LOGGING) {
    console.log(`Building web (vite) - ${params.configName} version`);
    config.log(envConfig);
  }

  // ESM-only deps imported dynamically since this file is CJS for parity with
  // webpack.base.js.
  const angular = (await import("@analogjs/vite-plugin-angular")).default;
  const wasm = (await import("vite-plugin-wasm")).default;

  // Resolve aliases for both the dep scanner and the dev server.
  //  - /__bw_*__            → entry files outside Vite's `root` (vite-root/)
  //  - path                 → path-browserify (mirrors webpack.base.js fallback)
  //  - importAliases        → consumer overrides (e.g. commercial SDK)
  // Entry files live at apps/web/src/* and bit-web/src/main.ts — all outside
  // vite-root/. Relative URLs in the HTML can't reach them (they normalize at
  // the server root), so we expose them as stable virtual paths the factory
  // aliases to absolute filesystem locations.
  const aliases = [
    { find: /^\/__bw_theme__$/, replacement: path.resolve(__dirname, "src/theme.ts") },
    { find: /^\/__bw_polyfills__$/, replacement: path.resolve(__dirname, "src/polyfills.ts") },
    { find: /^\/__bw_styles__$/, replacement: path.resolve(VITE_ROOT, "styles.mjs") },
    { find: /^\/__bw_main__$/, replacement: params.app.entry },
    { find: /^path$/, replacement: "path-browserify" },
    ...(params.importAliases ?? []).map((a) => ({ find: a.name, replacement: a.alias })),
  ];

  return {
    root: VITE_ROOT,
    publicDir: path.resolve(__dirname, "src"),
    define: buildDefines(envConfig, pjson.version, NODE_ENV, ENV),
    resolve: {
      alias: aliases,
      // Vite 8 reads tsconfig paths natively — no need for vite-tsconfig-paths.
      tsconfigPaths: true,
    },
    plugins: [angular({ tsconfig: params.tsConfig, jit: false }), wasm()],
    css: {
      postcss: path.resolve(__dirname, "postcss.config.js"),
    },
    optimizeDeps: {
      // Pre-bundle these so the dev server boots quickly. Adjust based on
      // observed cold-start scans.
      include: [
        "@angular/common",
        "@angular/core",
        "@angular/forms",
        "@angular/router",
        "@angular/platform-browser",
        "@angular/platform-browser-dynamic",
        "rxjs",
        "rxjs/operators",
        "zone.js",
      ],
      // Angular sources can't be pre-bundled (need Angular compiler).
      exclude: ["@bitwarden/sdk-internal", "@bitwarden/commercial-sdk-internal"],
    },
    server: {
      https: NODE_ENV === "development" ? buildHttpsOptions() : false,
      port: envConfig.dev?.port ?? 8080,
      host: true,
      strictPort: true,
      proxy: buildProxy(envConfig),
      headers: {
        "Content-Security-Policy": buildCsp(envConfig),
      },
      fs: {
        // Vite restricts file serving to `root`. Allow the whole repo so
        // /@fs/ URLs can reach apps/web/src and bit-web/src.
        allow: [REPO_ROOT],
      },
      watch: {
        // Avoid scanning these — they thrash the watcher on a monorepo.
        ignored: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.nx/**"],
      },
      warmup: {
        clientFiles: ["../../../bitwarden_license/bit-web/src/main.ts"],
      },
      open: true,
    },
  };
};
