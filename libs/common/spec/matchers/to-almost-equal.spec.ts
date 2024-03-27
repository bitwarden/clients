describe("toAlmostEqual custom matcher", () => {
  it("matches identical Dates", () => {
    const date = new Date();
    expect(date).toAlmostEqual(date);
  });

  it("matches when older but within default ms", () => {
    const date = new Date();
    const olderDate = new Date(date.getTime() - 5);
    expect(date).toAlmostEqual(olderDate);
  });

  it("matches when newer but within default ms", () => {
    const date = new Date();
    const olderDate = new Date(date.getTime() + 5);
    expect(date).toAlmostEqual(olderDate);
  });

  it("doesn't match if older than default ms", () => {
    const date = new Date();
    const olderDate = new Date(date.getTime() - 11);
    expect(date).not.toAlmostEqual(olderDate);
  });

  it("doesn't match if newer than default ms", () => {
    const date = new Date();
    const olderDate = new Date(date.getTime() + 11);
    expect(date).not.toAlmostEqual(olderDate);
  });

  it("matches when older but within custom ms", () => {
    const date = new Date();
    const olderDate = new Date(date.getTime() - 15);
    expect(date).toAlmostEqual(olderDate, 20);
  });

  it("matches when newer but within custom ms", () => {
    const date = new Date();
    const olderDate = new Date(date.getTime() + 15);
    expect(date).toAlmostEqual(olderDate, 20);
  });

  it("doesn't match if older than custom ms", () => {
    const date = new Date();
    const olderDate = new Date(date.getTime() - 21);
    expect(date).not.toAlmostEqual(olderDate, 20);
  });

  it("doesn't match if newer than custom ms", () => {
    const date = new Date();
    const olderDate = new Date(date.getTime() + 21);
    expect(date).not.toAlmostEqual(olderDate, 20);
  });
});
