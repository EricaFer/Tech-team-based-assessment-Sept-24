export type TestResult = "PASS" | "FAIL";
export type FailureCode = "" | "CAP_LOW" | "IR_HIGH" | "TEMP_HIGH";
export type SimulationProfile = "nominal" | "stressed" | "recovery";

export interface EolRecord {
  test_id: string;
  timestamp: string;
  station_id: string;
  module_serial: string;
  cell_lot: string;
  operator_id: string;
  capacity_ah: number;
  internal_resistance_mohm: number;
  temperature_c: number;
  result: TestResult;
  failure_code: FailureCode;
  simulated?: boolean;
}

export interface Summary {
  total: number;
  passed: number;
  failed: number;
  ftq: number;
  targetFtq: number;
  gapToTarget: number;
  avgCapacity: number;
  avgResistance: number;
  avgTemperature: number;
}

export interface StationMetric {
  station: string;
  total: number;
  passed: number;
  failed: number;
  ftq: number;
  status: "healthy" | "watch" | "critical";
}

export interface DefectMetric {
  code: Exclude<FailureCode, "">;
  label: string;
  count: number;
  percentage: number;
  processArea: string;
}

export interface TrendPoint {
  label: string;
  ftq: number;
  target: number;
  tests: number;
}

export interface DashboardData {
  summary: Summary;
  stations: StationMetric[];
  defects: DefectMetric[];
  trend: TrendPoint[];
  records: EolRecord[];
  lastUpdated: string;
  simulationRuns: number;
}
