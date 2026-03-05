describe("toContainPartialObjects", () => {
  describe("matches", () => {
    it("if the array only contains the partial objects", () => {
      const actual = [
        {
          id: 1,
          name: "foo",
        },
        {
          id: 2,
          name: "bar",
        },
      ];

      const expected = [{ id: 1 }, { id: 2 }];

      expect(actual).toContainPartialObjects(expected);
    });

    it("if the array contains the partial objects and other objects", () => {
      const actual = [
        {
          id: 1,
          name: "foo",
        },
        {
          id: 2,
          name: "bar",
        },
        {
          id: 3,
          name: "baz",
        },
      ];

      const expected = [{ id: 1 }, { id: 2 }];

      expect(actual).toContainPartialObjects(expected);
    });
  });

  describe("doesn't match", () => {
    it("if the array does not contain any partial objects", () => {
      const actual = [
        {
          id: 1,
          name: "foo",
        },
        {
          id: 2,
          name: "bar",
        },
      ];

      const expected = [{ id: 1, name: "Foo" }];

      expect(actual).not.toContainPartialObjects(expected);
    });

    it("if the array contains some but not all partial objects", () => {
      const actual = [
        {
          id: 1,
          name: "foo",
        },
        {
          id: 2,
          name: "bar",
        },
      ];

      const expected = [{ id: 2 }, { id: 3 }];

      expect(actual).not.toContainPartialObjects(expected);
    });
  });
});
