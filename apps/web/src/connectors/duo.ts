import { getQsParam } from "./common";

require("./duo.scss");

document.addEventListener("DOMContentLoaded", () => {
  const code = getQsParam("code");
  const state = getQsParam("state");

  const broadcastChannel = new BroadcastChannel("duo-broadcast");
  broadcastChannel.postMessage({ command: "duoResult", code: code, state: state });
});
