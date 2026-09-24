import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import type {
  DashboardData,
  DefectMetric,
  EolAlarm,
  EolRecord,
  FailureCode,
  SimulationProfile,
  StationMetric,
  TrendPoint,
} from "../src/types.js";

const PORT = Number(process.env.PORT) || 4173;
const TARGET_FTQ = 95;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSV_PATH = path.join(ROOT, "eol_test_results_mock_sample.csv");
const DEFECT_META = {
  CAP_LOW: { label: "Low capacity", processArea: "Electrode manufacturing" },
  IR_HIGH: { label: "High internal resistance", processArea: "Cell assembly" },
  TEMP_HIGH: { label: "Abnormal heat generation", processArea: "Formation & testing" },
} as const;
const ALARM_RULES = {
  CAP_LOW: {
    severity: "MAJOR",
    measurement_name: "capacity_ah",
    limit_value: 300,
    limit_operator: ">=",
    unit: "Ah",
    recommendation:
      "Quarantine the module and associated cell lot. Verify electrode coating uniformity, active-material loading, and capacity-test calibration before releasing the lot.",
  },
  IR_HIGH: {
    severity: "MAJOR",
    measurement_name: "internal_resistance_mohm",
    limit_value: 0.55,
    limit_operator: "<=",
    unit: "mΩ",
    recommendation:
      "Contain the module and inspect cell interconnects, weld integrity, electrolyte wetting, and contact resistance. Review the cell-assembly process history for the affected lot.",
  },
  TEMP_HIGH: {
    severity: "CRITICAL",
    measurement_name: "temperature_c",
    limit_value: 30,
    limit_operator: "<=",
    unit: "°C",
    recommendation:
      "Place the module in an immediate safety hold. Inspect for internal micro-shorts, abnormal formation current, cooling performance, and thermal-sensor calibration before retest.",
  },
} as const;

function loadSeedData(): EolRecord[] {
  const parsed = Papa.parse<Record<string, string>>(fs.readFileSync(CSV_PATH, "utf8"), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length) {
    throw new Error(`Unable to parse EOL seed data: ${parsed.errors[0].message}`);
  }

  return parsed.data.map((row) => ({
    test_id: row.test_id.trim(),
    timestamp: row.timestamp.trim(),
    station_id: row.station_id.trim(),
    module_serial: row.module_serial.trim(),
    cell_lot: row.cell_lot.trim(),
    operator_id: row.operator_id.trim(),
    capacity_ah: Number(row.capacity_ah),
    internal_resistance_mohm: Number(row.internal_resistance_mohm),
    temperature_c: Number(row.temperature_c),
    result: row.result.trim().toUpperCase() as EolRecord["result"],
    failure_code: row.failure_code.trim().toUpperCase() as FailureCode,
  }));
}

const seedRecords = loadSeedData();
let records = structuredClone(seedRecords);
let simulationRuns = 0;

const round = (value: number, digits = 1) => Number(value.toFixed(digits));
const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export function buildAlarms(source: EolRecord[]): EolAlarm[] {
  return source
    .filter(
      (record): record is EolRecord & { failure_code: Exclude<FailureCode, ""> } =>
        record.result === "FAIL" && record.failure_code !== "",
    )
    .map((record) => {
      const rule = ALARM_RULES[record.failure_code];
      return {
        alarm_id: `ALM-${record.test_id}`,
        test_id: record.test_id,
        detected_at: new Date(record.timestamp.replace(" ", "T")).toISOString(),
        station_id: record.station_id,
        module_serial: record.module_serial,
        cell_lot: record.cell_lot,
        failure_code: record.failure_code,
        severity: rule.severity,
        status: "ACTIVE" as const,
        title: DEFECT_META[record.failure_code].label,
        process_area: DEFECT_META[record.failure_code].processArea,
        measurement_name: rule.measurement_name,
        measured_value: record[rule.measurement_name],
        limit_value: rule.limit_value,
        limit_operator: rule.limit_operator,
        unit: rule.unit,
        recommendation: rule.recommendation,
      };
    })
    .sort(
      (a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime(),
    );
}

export function buildDashboardData(source: EolRecord[]): DashboardData {
  const passed = source.filter((record) => record.result === "PASS").length;
  const failed = source.length - passed;
  const ftq = source.length ? (passed / source.length) * 100 : 0;

  const stations: StationMetric[] = [...new Set(source.map((record) => record.station_id))]
    .sort()
    .map((station) => {
      const stationRecords = source.filter((record) => record.station_id === station);
      const stationPassed = stationRecords.filter((record) => record.result === "PASS").length;
      const stationFtq = (stationPassed / stationRecords.length) * 100;
      return {
        station,
        total: stationRecords.length,
        passed: stationPassed,
        failed: stationRecords.length - stationPassed,
        ftq: round(stationFtq),
        status: stationFtq >= 95 ? "healthy" : stationFtq >= 85 ? "watch" : "critical",
      };
    });

  const defects = (Object.keys(DEFECT_META) as Array<keyof typeof DEFECT_META>)
    .map<DefectMetric>((code) => {
      const count = source.filter((record) => record.failure_code === code).length;
      return {
        code,
        ...DEFECT_META[code],
        count,
        percentage: failed ? round((count / failed) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  const trend: TrendPoint[] = [];
  const ordered = [...source].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  for (let index = 0; index < ordered.length; index += 5) {
    const window = ordered.slice(index, index + 5);
    const windowPassed = window.filter((record) => record.result === "PASS").length;
    trend.push({
      label: new Date(window.at(-1)!.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      ftq: round((windowPassed / window.length) * 100),
      target: TARGET_FTQ,
      tests: window.length,
    });
  }

  return {
    summary: {
      total: source.length,
      passed,
      failed,
      ftq: round(ftq),
      targetFtq: TARGET_FTQ,
      gapToTarget: round(ftq - TARGET_FTQ),
      avgCapacity: round(average(source.map((record) => record.capacity_ah)), 2),
      avgResistance: round(
        average(source.map((record) => record.internal_resistance_mohm)),
        4,
      ),
      avgTemperature: round(average(source.map((record) => record.temperature_c)), 1),
    },
    stations,
    defects,
    trend,
    records: ordered.reverse(),
    alarms: buildAlarms(source),
    lastUpdated: new Date().toISOString(),
    simulationRuns,
  };
}

function randomNormal(mean: number, deviation: number) {
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + deviation * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function generateRecord(index: number, profile: SimulationProfile): EolRecord {
  const failureRates: Record<SimulationProfile, number> = {
    nominal: 0.06,
    stressed: 0.28,
    recovery: 0.02,
  };
  const defectCodes: Array<Exclude<FailureCode, "">> = ["CAP_LOW", "IR_HIGH", "TEMP_HIGH"];
  const isFailure = Math.random() < failureRates[profile];
  const failureCode = isFailure
    ? defectCodes[Math.floor(Math.random() * defectCodes.length)]
    : "";
  const latestTimestamp = Math.max(...records.map((record) => new Date(record.timestamp).getTime()));
  const timestamp = new Date(latestTimestamp + (index + 1) * (4 + Math.random() * 3) * 60_000);
  const serialNumber = 900000 + records.length + index + 1;
  const stationNumber = ((records.length + index) % 4) + 1;

  let capacity = randomNormal(304.5, 2.1);
  let resistance = randomNormal(0.425, 0.026);
  let temperature = randomNormal(26.5, 1.1);
  if (failureCode === "CAP_LOW") capacity = randomNormal(297.8, 0.8);
  if (failureCode === "IR_HIGH") resistance = randomNormal(0.58, 0.015);
  if (failureCode === "TEMP_HIGH") temperature = randomNormal(31.5, 0.5);

  return {
    test_id: `T${serialNumber}`,
    timestamp: timestamp.toISOString(),
    station_id: `EOL-0${stationNumber}`,
    module_serial: `MPM-${serialNumber}`,
    cell_lot: `LOT-M10${((records.length + index) % 3) + 1}`,
    operator_id: `op_${301 + ((records.length + index) % 8)}`,
    capacity_ah: round(capacity, 2),
    internal_resistance_mohm: round(resistance, 4),
    temperature_c: round(temperature, 1),
    result: isFailure ? "FAIL" : "PASS",
    failure_code: failureCode,
    simulated: true,
  };
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", records: records.length });
});

app.get("/api/dashboard", (_request, response) => {
  response.json(buildDashboardData(records));
});

app.get("/api/alarms", (_request, response) => {
  const alarms = buildAlarms(records);
  response.json({
    active_count: alarms.length,
    critical_count: alarms.filter((alarm) => alarm.severity === "CRITICAL").length,
    alarms,
  });
});

app.post("/api/simulate", (request, response) => {
  const requestedCount = Number(request.body?.count ?? 12);
  const count = Math.min(Math.max(Math.round(requestedCount), 1), 50);
  const requestedProfile = request.body?.profile as SimulationProfile;
  const profile: SimulationProfile = ["nominal", "stressed", "recovery"].includes(
    requestedProfile,
  )
    ? requestedProfile
    : "nominal";

  const generated = Array.from({ length: count }, (_, index) => generateRecord(index, profile));
  records.push(...generated);
  simulationRuns += 1;
  response.status(201).json(buildDashboardData(records));
});

app.post("/api/reset", (_request, response) => {
  records = structuredClone(seedRecords);
  simulationRuns = 0;
  response.json(buildDashboardData(records));
});

const distPath = path.join(ROOT, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((request, response, next) => {
    if (request.method === "GET" && request.accepts("html")) {
      response.sendFile(path.join(distPath, "index.html"));
      return;
    }
    next();
  });
}

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`EOL simulation API listening on http://localhost:${PORT}`);
  });
}
