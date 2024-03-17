import { SuppressDownloadScriptInjectionConfig } from "../background/abstractions/fileless-importer.background";

type FilelessImporterInjectedScriptsConfigurations = {
  LpSuppressImportDownload: {
    mv2: SuppressDownloadScriptInjectionConfig;
    mv3: SuppressDownloadScriptInjectionConfig;
  };
};

const FilelessImporterInjectedScriptsConfig: FilelessImporterInjectedScriptsConfigurations = {
  LpSuppressImportDownload: {
    mv2: {
      file: "content/lp-suppress-import-download-script-append-mv2.js",
    },
    mv3: {
      file: "content/lp-suppress-import-download.js",
      scriptingApiDetails: { world: "MAIN" },
    },
  },
} as const;

export { FilelessImporterInjectedScriptsConfig };
