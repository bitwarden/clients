import { TestBed } from "@angular/core/testing";

import { Vfo1TerminologyService } from "../services/vfo1-terminology.service";

import { Vfo1IconPipe } from "./vfo1-icon.pipe";

describe("Vfo1IconPipe", () => {
  let iconClassFn: jest.Mock<string, [string]>;
  let enabledFn: jest.Mock<boolean, []>;
  let pipe: Vfo1IconPipe;

  beforeEach(() => {
    enabledFn = jest.fn<boolean, []>().mockReturnValue(false);
    iconClassFn = jest.fn<string, [string]>().mockImplementation((icon) => icon);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: Vfo1TerminologyService,
          useValue: { enabled: enabledFn, iconClass: iconClassFn },
        },
        Vfo1IconPipe,
      ],
    });

    pipe = TestBed.inject(Vfo1IconPipe);
  });

  it("returns the mapped icon class from the service", () => {
    iconClassFn.mockReturnValue("bwi-shared-folder");

    expect(pipe.transform("bwi-collection-shared")).toBe("bwi-shared-folder");
    expect(iconClassFn).toHaveBeenCalledWith("bwi-collection-shared");
  });

  it("returns cached result on repeated call with same args", () => {
    pipe.transform("bwi-collection-shared");
    pipe.transform("bwi-collection-shared");

    expect(iconClassFn).toHaveBeenCalledTimes(1);
  });

  it("recomputes when the flag flips", () => {
    pipe.transform("bwi-collection-shared");

    enabledFn.mockReturnValue(true);

    pipe.transform("bwi-collection-shared");

    expect(iconClassFn).toHaveBeenCalledTimes(2);
  });

  it("recomputes when the icon class changes", () => {
    pipe.transform("bwi-collection-shared");
    pipe.transform("bwi-user");

    expect(iconClassFn).toHaveBeenCalledTimes(2);
    expect(iconClassFn).toHaveBeenNthCalledWith(2, "bwi-user");
  });
});
