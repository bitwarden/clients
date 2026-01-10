// This test skips all the initialization of the background script and just
// focuses on making sure we don't accidentally delete the initialization of
// background vault syncing. This has happened before!
describe("MainBackground sync task scheduling", () => {
  it("includes code to schedule the sync interval task", () => {
    // Get the bootstrap method source code as string
    const { default: MainBackground } = jest.requireActual("./main.background");
    const bootstrapSource = MainBackground.prototype.bootstrap.toString();

    // Check that the source includes the critical sync interval scheduling code
    expect(bootstrapSource).toContain("this.backgroundSyncService.init();");
  });
});
