import { apiErrorBodyMessage } from "./api-error";

describe("apiErrorBodyMessage", () => {
  const wrap = (body: string) => `error in response: status code 400 Bad Request: ${body}`;

  it("extracts the server message from the embedded ErrorResponseModel body", () => {
    expect(apiErrorBodyMessage(wrap('{"message":"A rule with that name already exists."}'))).toBe(
      "A rule with that name already exists.",
    );
  });

  it("extracts the message when the transport appended content after the body", () => {
    expect(
      apiErrorBodyMessage(`${wrap('{"message":"The approved access window has already ended."}')}
       (request id 8f2c)`),
    ).toBe("The approved access window has already ended.");
  });

  it("keeps the last brace of a nested body", () => {
    expect(
      apiErrorBodyMessage(wrap('{"message":"Bad input.","validationErrors":{"name":[]}}')),
    ).toBe("Bad input.");
  });

  it("returns undefined when the body has no usable message", () => {
    expect(apiErrorBodyMessage(wrap('{"message":""}'))).toBeUndefined();
    expect(apiErrorBodyMessage(wrap('{"validationErrors":{}}'))).toBeUndefined();
    expect(apiErrorBodyMessage(wrap('{"message":42}'))).toBeUndefined();
  });

  it("returns undefined when there is no JSON body (network/serde failures)", () => {
    expect(apiErrorBodyMessage("error in reqwest: timed out")).toBeUndefined();
    expect(apiErrorBodyMessage(wrap("not json"))).toBeUndefined();
    expect(apiErrorBodyMessage("")).toBeUndefined();
  });

  it("returns undefined when the closing brace precedes the opening one", () => {
    expect(apiErrorBodyMessage('} {"message":"never closed"')).toBeUndefined();
  });
});
