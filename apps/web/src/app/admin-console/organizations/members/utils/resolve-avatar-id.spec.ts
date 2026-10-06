import { resolveAvatarId } from "./resolve-avatar-id";

describe("resolveAvatarId", () => {
  it("prefers the account id (userId) when present", () => {
    expect(resolveAvatarId({ id: "org-user-id", userId: "account-id" })).toBe("account-id");
  });

  it("falls back to the org/provider user id when userId is undefined", () => {
    expect(resolveAvatarId({ id: "org-user-id", userId: undefined })).toBe("org-user-id");
  });

  it("falls back to the org/provider user id when userId is not provided", () => {
    expect(resolveAvatarId({ id: "org-user-id" })).toBe("org-user-id");
  });

  it("falls back to the org/provider user id when userId is null", () => {
    const user: { id: string; userId?: string } = { id: "org-user-id", userId: null as any };
    expect(resolveAvatarId(user)).toBe("org-user-id");
  });

  it("returns the same id for the same member regardless of which caller resolves it", () => {
    // Regression test: the members list and every bulk action dialog must resolve the same
    // avatar identifier for the same member, otherwise the same person shows a different
    // avatar color in different parts of the UI.
    const invitedMember: { id: string; userId?: string } = { id: "org-user-id", userId: undefined };

    const idAsRenderedByMembersList = resolveAvatarId(invitedMember);
    const idAsRenderedByBulkDialog = resolveAvatarId(invitedMember);

    expect(idAsRenderedByMembersList).toBe(idAsRenderedByBulkDialog);
    expect(idAsRenderedByMembersList).toBe("org-user-id");
  });
});
