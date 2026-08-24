import { RotationDaemonDetailsResponse } from "./rotation-daemon-details.response";

describe("RotationDaemonDetailsResponse", () => {
  it("parses the base daemon fields and the nested jobs", () => {
    const response = new RotationDaemonDetailsResponse({
      Id: "daemon-1",
      Name: "On-prem daemon",
      Status: 0,
      IsConnected: true,
      AssignedTargetSystemIds: ["ts-1", "ts-2"],
      Jobs: [
        {
          Id: "job-1",
          Source: 0,
          Status: 2,
          CreatedAt: "2026-07-01T00:00:00Z",
          Attempts: [
            {
              Id: "attempt-1",
              Status: 1,
              StartedAt: "2026-07-01T00:00:01Z",
              EndedAt: "2026-07-01T00:00:05Z",
            },
          ],
        },
      ],
    });

    expect(response.id).toBe("daemon-1");
    expect(response.name).toBe("On-prem daemon");
    expect(response.status).toBe(0);
    expect(response.isConnected).toBe(true);
    expect(response.assignments).toEqual(["ts-1", "ts-2"]);
    expect(response.jobs).toHaveLength(1);
    expect(response.jobs[0].id).toBe("job-1");
    expect(response.jobs[0].attempts).toHaveLength(1);
    expect(response.jobs[0].attempts[0].id).toBe("attempt-1");
  });

  it("defaults jobs to an empty array when absent", () => {
    const response = new RotationDaemonDetailsResponse({
      Id: "daemon-2",
      Name: "No activity",
      Status: 0,
      IsConnected: false,
      AssignedTargetSystemIds: [],
    });

    expect(response.jobs).toEqual([]);
  });
});
