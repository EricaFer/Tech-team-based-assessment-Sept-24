export type TestResult = "PASS" | "FAIL";
export type FailureCode = "" | "CAP_LOW" | "IR_HIGH" | "TEMP_HIGH";
export type SimulationProfile = "nominal" | "stressed" | "recovery";
export type AlarmSeverity = "MAJOR" | "CRITICAL";

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

export interface EolAlarm {
  alarm_id: string;
  test_id: string;
  detected_at: string;
  station_id: string;
  module_serial: string;
  cell_lot: string;
  failure_code: Exclude<FailureCode, "">;
  severity: AlarmSeverity;
  status: "ACTIVE";
  title: string;
  process_area: string;
  measurement_name: "capacity_ah" | "internal_resistance_mohm" | "temperature_c";
  measured_value: number;
  limit_value: number;
  limit_operator: ">=" | "<=";
  unit: "Ah" | "mΩ" | "°C";
  recommendation: string;
}

export interface DashboardData {
  summary: Summary;
  stations: StationMetric[];
  defects: DefectMetric[];
  trend: TrendPoint[];
  records: EolRecord[];
  alarms: EolAlarm[];
  lastUpdated: string;
  simulationRuns: number;
}
