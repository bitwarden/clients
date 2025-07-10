export function getQsParam(name: string) {
  const url = window.location.href;
  // eslint-disable-next-line
  name = name.replace(/[\[\]]/g, "\\$&");
  const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
  const results = regex.exec(url);

  if (!results) {
    return null;
  }
  if (!results[2]) {
    return "";
  }

  return decodeURIComponent(results[2].replace(/\+/g, " "));
}

export function b64Decode(str: string, spaceAsPlus = false) {
  if (spaceAsPlus) {
    str = str.replace(/ /g, "+");
  }

  return decodeURIComponent(
    Array.prototype.map
      .call(atob(str), (c: string) => {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join(""),
  );
}
