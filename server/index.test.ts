import { describe, expect, it } from "vitest";
import type { EolRecord } from "../src/types";
import { buildDashboardData } from "./index";

const records: EolRecord[] = [
  {
    test_id: "T1",
    timestamp: "2026-09-21T10:00:00.000Z",
    station_id: "EOL-01",
    module_serial: "MPM-1",
    cell_lot: "LOT-1",
    operator_id: "op_1",
    capacity_ah: 305,
    internal_resistance_mohm: 0.42,
    temperature_c: 26,
    result: "PASS",
    failure_code: "",
  },
  {
    test_id: "T2",
    timestamp: "2026-09-21T10:05:00.000Z",
    station_id: "EOL-01",
    module_serial: "MPM-2",
    cell_lot: "LOT-1",
    operator_id: "op_1",
    capacity_ah: 298,
    internal_resistance_mohm: 0.43,
    temperature_c: 27,
    result: "FAIL",
    failure_code: "CAP_LOW",
  },
];

describe("buildDashboardData", () => {
  it("calculates FTQ and process averages", () => {
    const dashboard = buildDashboardData(records);

    expect(dashboard.summary.ftq).toBe(50);
    expect(dashboard.summary.passed).toBe(1);
    expect(dashboard.summary.failed).toBe(1);
    expect(dashboard.summary.avgCapacity).toBe(301.5);
    expect(dashboard.summary.gapToTarget).toBe(-45);
  });

  it("aggregates station and defect performance", () => {
    const dashboard = buildDashboardData(records);

    expect(dashboard.stations[0]).toMatchObject({
      station: "EOL-01",
      total: 2,
      failed: 1,
      status: "critical",
    });
    expect(dashboard.defects[0]).toMatchObject({
      code: "CAP_LOW",
      count: 1,
      percentage: 100,
    });
  });
});
