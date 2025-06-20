import { spawn } from "child_process";
import * as path from "path";

import { app } from "electron";

import { autotype } from "@bitwarden/desktop-napi";

if (
  process.platform === "darwin" &&
  process.argv.some((arg) => arg.indexOf("chrome-extension://") !== -1 || arg.indexOf("{") !== -1)
) {
  // If we're on MacOS, we need to support DuckDuckGo's IPC communication,
  // which for the moment is launching the Bitwarden process.
  // Ideally the browser would instead startup the desktop_proxy process
  // when available, but for now we'll just launch it here.

  app.on("ready", () => {
    app.dock.hide();
  });

  const proc = spawn(
    path.join(process.execPath, "..", "desktop_proxy.inherit"),
    process.argv.slice(1),
    {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: false,
    },
  );

  proc.on("exit", (...args) => {
    // eslint-disable-next-line no-console
    console.error("Proxy process exited", args);
    process.exit(0);
  });
  proc.on("error", (...args) => {
    // eslint-disable-next-line no-console
    console.error("Proxy process errored", args);
    process.exit(1);
  });
} else {
  // eslint-disable-next-line
  const Main = require("./main").Main;

  // Testing autotype hotkey registration
  //const r = autotype.registerHotkey();
  // eslint-disable-next-line no-console
  //console.log("registerHotkey(): ");
  // eslint-disable-next-line no-console
  //console.log(r);

  const main = new Main();
  main.bootstrap();
}
