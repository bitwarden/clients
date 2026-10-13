import { FetchMiddleware, buildFetchPipeline } from "./fetch-middleware";

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    url: "https://example.com",
    method: "GET",
    headers: new Headers(),
    ...overrides,
  } as unknown as Request;
}

function makeResponse(overrides: Partial<Response> = {}): Response {
  return {
    ok: true,
    status: 200,
    ...overrides,
  } as unknown as Response;
}

describe("buildFetchPipeline", () => {
  let terminal: jest.Mock<Promise<Response>, [Request]>;
  let terminalResponse: Response;

  beforeEach(() => {
    terminalResponse = makeResponse();
    terminal = jest.fn<Promise<Response>, [Request]>().mockResolvedValue(terminalResponse);
  });

  it("calls terminal directly when middleware array is empty", async () => {
    const pipeline = buildFetchPipeline([], terminal);
    const request = makeRequest();

    const response = await pipeline(request);

    expect(terminal).toHaveBeenCalledWith(request);
    expect(response).toBe(terminalResponse);
  });

  it("passes request through a single pass-through middleware", async () => {
    const middleware: FetchMiddleware = async (req, next) => next(req);
    const pipeline = buildFetchPipeline([middleware], terminal);
    const request = makeRequest();

    const response = await pipeline(request);

    expect(terminal).toHaveBeenCalledWith(request);
    expect(response).toBe(terminalResponse);
  });

  it("allows middleware to modify the request before next", async () => {
    const middleware: FetchMiddleware = async (req, next) => {
      req.headers.set("X-Custom", "value");
      return next(req);
    };
    const pipeline = buildFetchPipeline([middleware], terminal);
    const request = makeRequest();

    await pipeline(request);

    expect(terminal).toHaveBeenCalledTimes(1);
    const passedRequest = terminal.mock.calls[0][0];
    expect(passedRequest.headers.get("X-Custom")).toBe("value");
  });

  it("allows middleware to modify the response after next", async () => {
    const modifiedResponse = makeResponse({ status: 201 });
    const middleware: FetchMiddleware = async (req, next) => {
      await next(req);
      return modifiedResponse;
    };
    const pipeline = buildFetchPipeline([middleware], terminal);
    const request = makeRequest();

    const response = await pipeline(request);

    expect(response).toBe(modifiedResponse);
  });

  it("allows middleware to short-circuit without calling next", async () => {
    const shortCircuitResponse = makeResponse({ status: 403 });
    const middleware: FetchMiddleware = async (_req, _next) => {
      return shortCircuitResponse;
    };
    const pipeline = buildFetchPipeline([middleware], terminal);
    const request = makeRequest();

    const response = await pipeline(request);

    expect(response).toBe(shortCircuitResponse);
    expect(terminal).not.toHaveBeenCalled();
  });

  it("allows middleware to retry by calling next multiple times", async () => {
    const retryResponse = makeResponse();
    let callCount = 0;
    terminal.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return makeResponse({ status: 500, ok: false });
      }
      return retryResponse;
    });

    const retryMiddleware: FetchMiddleware = async (req, next) => {
      const response = await next(req);
      if (response.status === 500) {
        return next(req);
      }
      return response;
    };
    const pipeline = buildFetchPipeline([retryMiddleware], terminal);
    const request = makeRequest();

    const response = await pipeline(request);

    expect(terminal).toHaveBeenCalledTimes(2);
    expect(response).toBe(retryResponse);
  });

  it("executes middlewares with first-added as outermost", async () => {
    const callOrder: string[] = [];

    const outer: FetchMiddleware = async (req, next) => {
      callOrder.push("outer-before");
      const response = await next(req);
      callOrder.push("outer-after");
      return response;
    };
    const inner: FetchMiddleware = async (req, next) => {
      callOrder.push("inner-before");
      const response = await next(req);
      callOrder.push("inner-after");
      return response;
    };
    const pipeline = buildFetchPipeline([outer, inner], terminal);
    const request = makeRequest();

    await pipeline(request);

    expect(callOrder).toEqual(["outer-before", "inner-before", "inner-after", "outer-after"]);
  });

  it("propagates errors from terminal", async () => {
    const error = new Error("network failure");
    terminal.mockRejectedValue(error);

    const middleware: FetchMiddleware = async (req, next) => next(req);
    const pipeline = buildFetchPipeline([middleware], terminal);
    const request = makeRequest();

    await expect(pipeline(request)).rejects.toThrow("network failure");
  });

  it("propagates errors thrown by middleware", async () => {
    const middleware: FetchMiddleware = async (_req, _next) => {
      throw new Error("middleware error");
    };
    const pipeline = buildFetchPipeline([middleware], terminal);
    const request = makeRequest();

    await expect(pipeline(request)).rejects.toThrow("middleware error");
    expect(terminal).not.toHaveBeenCalled();
  });
});
