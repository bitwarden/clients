export function isBrowserSafariApi(): boolean {
  return (
    navigator.userAgent.indexOf(" Safari/") !== -1 &&
    navigator.userAgent.indexOf(" Chrome/") === -1 &&
    navigator.userAgent.indexOf(" Chromium/") === -1
  );
}
