import { AvatarIdPipe } from "./avatar-id.pipe";

describe("AvatarIdPipe", () => {
  let pipe: AvatarIdPipe;

  beforeEach(() => {
    pipe = new AvatarIdPipe();
  });

  it("prefers the account id (userId) when present", () => {
    expect(pipe.transform({ id: "org-user-id", userId: "account-id" })).toBe("account-id");
  });

  it("falls back to the org/provider user id when userId is not provided", () => {
    expect(pipe.transform({ id: "org-user-id" })).toBe("org-user-id");
  });
});
