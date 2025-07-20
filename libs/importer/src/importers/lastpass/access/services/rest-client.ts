// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export class RestClient {
  baseUrl: string;
  isBrowser = true;

  async get(
    endpoint: string,
    headers: Map<string, string> = null,
    cookies: Map<string, string> = null,
  ): Promise<Response> {
    const requestInit: RequestInit = {
      method: "GET",
      credentials: "include",
    };
    this.setHeaders(requestInit, headers, cookies);
    const request = new Request(this.baseUrl + "/" + endpoint, requestInit);
    const response = await fetch(request);
    return response;
  }

  async postForm(
    endpoint: string,
    parameters: Map<string, any> = null,
    headers: Map<string, string> = null,
    cookies: Map<string, string> = null,
  ): Promise<Response> {
    const setBody = (requestInit: RequestInit, headerMap: Map<string, string>) => {
      if (parameters != null && parameters.size > 0) {
        const form = new FormData();
        for (const [key, value] of parameters) {
          form.set(key, value);
        }
        requestInit.body = form;
      }
    };
    return await this.post(endpoint, setBody, headers, cookies);
  }

  async postJson(
    endpoint: string,
    body: any,
    headers: Map<string, string> = null,
    cookies: Map<string, string> = null,
  ): Promise<Response> {
    const setBody = (requestInit: RequestInit, headerMap: Map<string, string>) => {
      if (body != null) {
        headerMap.set("Content-Type", "application/json; charset=utf-8");
        requestInit.body = JSON.stringify(body);
      }
    };
    return await this.post(endpoint, setBody, headers, cookies);
  }

  private async post(
    endpoint: string,
    setBody: (requestInit: RequestInit, headers: Map<string, string>) => void,
    headers: Map<string, string> = null,
    cookies: Map<string, string> = null,
  ) {
    const requestInit: RequestInit = {
      method: "POST",
      credentials: "include",
    };
    if (headers == null) {
      headers = new Map<string, string>();
    }
    setBody(requestInit, headers);
    this.setHeaders(requestInit, headers, cookies);
    const request = new Request(this.baseUrl + "/" + endpoint, requestInit);
    const response = await fetch(request);
    return response;
  }

  private setHeaders(
    requestInit: RequestInit,
    headers: Map<string, string> = null,
    cookies: Map<string, string> = null,
  ) {
    const requestHeaders = new Headers();
    let setHeaders = false;
    if (headers != null && headers.size > 0) {
      setHeaders = true;
      for (const [key, value] of headers) {
        requestHeaders.set(key, value);
      }
    }
    // Cookies should be already automatically set for this origin by the browser
    // TODO: set cookies for non-browser scenarios?
    if (!this.isBrowser && cookies != null && cookies.size > 0) {
      setHeaders = true;
      const cookieString = Array.from(cookies.keys())
        .map((key) => `${key}=${cookies.get(key)}`)
        .join("; ");
      requestHeaders.set("cookie", cookieString);
    }
    if (setHeaders) {
      requestInit.headers = requestHeaders;
    }
  }
}
