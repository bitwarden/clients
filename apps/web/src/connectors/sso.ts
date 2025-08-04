// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { getQsParam } from "./common";

window.addEventListener("load", () => {
  const code = getQsParam("code");
  const state = getQsParam("state");
  const lastpass = getQsParam("lp");

  if (lastpass === "1") {
    initiateBrowserSso(code, state, true);
  } else if (state != null && state.includes(":clientId=browser")) {
    initiateBrowserSso(code, state, false);
  } else {
    initiateWebAppSso(code, state);
  }
});

export function initiateWebAppSso(code: string, state: string) {
  // If we've initiated SSO from somewhere other than the SSO component on the web app, the SSO component will add
  // a _returnUri to the state variable. Here we're extracting that URI and sending the user there instead of to the SSO component.
  const returnUri = extractFromRegex(state, "(?<=_returnUri=')(.*)(?=')");
  if (returnUri) {
    window.location.href = window.location.origin + `/#${returnUri}`;
  } else {
    window.location.href = window.location.origin + "/#/sso?code=" + code + "&state=" + state;
  }
}

export function initiateBrowserSso(code: string, state: string, lastpass: boolean) {
  window.postMessage({ command: "authResult", code, state, lastpass }, window.location.origin);
  const handOffMessage = ("; " + document.cookie)
    .split("; ssoHandOffMessage=")
    .pop()
    .split(";")
    .shift();
  document.cookie = "ssoHandOffMessage=;SameSite=strict;max-age=0";
  const content = document.getElementById("content");
  content.innerHTML = "";
  const p = document.createElement("p");
  p.innerText = handOffMessage;
  content.appendChild(p);
}

function extractFromRegex(s: string, regexString: string) {
  const regex = new RegExp(regexString);
  const results = regex.exec(s);

  if (!results) {
    return null;
  }

  return results[0];
}
