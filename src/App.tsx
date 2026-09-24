import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  ChevronDown,
  CircleStop,
  Factory,
  Gauge,
  Play,
  RefreshCcw,
  Search,
  ShieldCheck,
  Thermometer,
  TimerReset,
  XCircle,
  Zap,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DashboardData,
  EolRecord,
  SimulationProfile,
  StationMetric,
} from "./types";

const API = "/api";

const defectLabels: Record<string, string> = {
  CAP_LOW: "Low capacity",
  IR_HIGH: "High internal resistance",
  TEMP_HIGH: "Abnormal heat",
};

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

function formatDate(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(timestamp));
}

function FtqGauge({ value, target }: { value: number; target: number }) {
  const color = value >= target ? "#32d583" : value >= 85 ? "#fdb022" : "#f97066";
  return (
    <div
      className="ftq-gauge"
      style={{
        background: `conic-gradient(${color} ${value * 3.6}deg, rgba(255,255,255,.08) 0deg)`,
      }}
      aria-label={`First time quality ${value} percent`}
    >
      <div className="ftq-gauge__inner">
        <strong>{value.toFixed(1)}%</strong>
        <span>FTQ</span>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  unit,
  detail,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  detail: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__top">
        <span className="metric-card__icon">{icon}</span>
        <span className="metric-card__label">{label}</span>
      </div>
      <div className="metric-card__value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      <div className="metric-card__detail">{detail}</div>
    </article>
  );
}

function StationCard({ station }: { station: StationMetric }) {
  return (
    <article className="station-card">
      <div className="station-card__header">
        <div>
          <span className="eyebrow">TEST STATION</span>
          <h3>{station.station}</h3>
        </div>
        <span className={`status-chip status-chip--${station.status}`}>
          <span />
          {station.status}
        </span>
      </div>
      <div className="station-card__ftq">
        <strong>{station.ftq.toFixed(1)}%</strong>
        <span>First-time quality</span>
      </div>
      <div className="progress-track">
        <span style={{ width: `${station.ftq}%` }} />
      </div>
      <div className="station-card__counts">
        <span>
          <b>{station.total}</b> tested
        </span>
        <span>
          <b>{station.failed}</b> defects
        </span>
      </div>
    </article>
  );
}

function ResultTable({ records }: { records: EolRecord[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | "PASS" | "FAIL">("ALL");
  const filtered = useMemo(
    () =>
      records
        .filter((record) => filter === "ALL" || record.result === filter)
        .filter((record) => {
          const value = query.toLowerCase();
          return (
            record.module_serial.toLowerCase().includes(value) ||
            record.test_id.toLowerCase().includes(value) ||
            record.cell_lot.toLowerCase().includes(value)
          );
        })
        .slice(0, 12),
    [filter, query, records],
  );

  return (
    <section className="panel results-panel">
      <div className="panel__header panel__header--wrap">
        <div>
          <span className="eyebrow">TRACEABILITY</span>
          <h2>Individual test results</h2>
        </div>
        <div className="table-tools">
          <label className="search-box">
            <Search size={15} />
            <input
              aria-label="Search test results"
              placeholder="Search serial, test or lot"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="filter-select">
            <select
              aria-label="Filter by test result"
              value={filter}
              onChange={(event) => setFilter(event.target.value as typeof filter)}
            >
              <option value="ALL">All results</option>
              <option value="PASS">Pass</option>
              <option value="FAIL">Fail</option>
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Module / Test</th>
              <th>Station</th>
              <th>Cell lot</th>
              <th>Capacity</th>
              <th>Resistance</th>
              <th>Temperature</th>
              <th>Test time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((record) => (
              <tr key={record.test_id}>
                <td>
                  <span className={`result result--${record.result.toLowerCase()}`}>
                    {record.result === "PASS" ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <XCircle size={14} />
                    )}
                    {record.result}
                  </span>
                </td>
                <td>
                  <strong className="serial">{record.module_serial}</strong>
                  <small>{record.test_id}</small>
                </td>
                <td>{record.station_id}</td>
                <td>{record.cell_lot}</td>
                <td className={record.failure_code === "CAP_LOW" ? "outlier" : ""}>
                  {record.capacity_ah.toFixed(2)} Ah
                </td>
                <td className={record.failure_code === "IR_HIGH" ? "outlier" : ""}>
                  {record.internal_resistance_mohm.toFixed(4)} mΩ
                </td>
                <td className={record.failure_code === "TEMP_HIGH" ? "outlier" : ""}>
                  {record.temperature_c.toFixed(1)} °C
                </td>
                <td>
                  <span>{formatTime(record.timestamp)}</span>
                  {record.simulated && <small className="simulated-tag">SIMULATED</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <div className="empty-state">No matching test results.</div>}
      </div>
    </section>
  );
}

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [profile, setProfile] = useState<SimulationProfile>("nominal");
  const [count, setCount] = useState(12);

  async function loadDashboard() {
    try {
      setError("");
      const response = await fetch(`${API}/dashboard`);
      if (!response.ok) throw new Error("Dashboard service is unavailable.");
      setData(await response.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.");
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function runSimulation() {
    setIsSimulating(true);
    setError("");
    try {
      const response = await fetch(`${API}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, count }),
      });
      if (!response.ok) throw new Error("Simulation could not be completed.");
      setData(await response.json());
    } catch (simulationError) {
      setError(
        simulationError instanceof Error ? simulationError.message : "Simulation failed.",
      );
    } finally {
      setIsSimulating(false);
    }
  }

  async function resetSimulation() {
    setIsSimulating(true);
    try {
      const response = await fetch(`${API}/reset`, { method: "POST" });
      if (!response.ok) throw new Error("Unable to reset simulation.");
      setData(await response.json());
      setError("");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Reset failed.");
    } finally {
      setIsSimulating(false);
    }
  }

  if (!data && !error) {
    return (
      <div className="loading-screen">
        <div className="loading-mark">
          <BatteryCharging size={28} />
        </div>
        <p>Connecting to the EOL quality line…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="loading-screen">
        <AlertTriangle size={30} />
        <h1>Quality service unavailable</h1>
        <p>{error}</p>
        <button className="button button--primary" onClick={loadDashboard}>
          Retry connection
        </button>
      </div>
    );
  }

  const { summary } = data;
  const latest = data.records[0];
  const topDefect = data.defects[0];
  const yieldTone = summary.ftq >= summary.targetFtq ? "positive" : "negative";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand__mark">S</div>
          <div>
            <strong>Industrial Quality Intelligence</strong>
            <span>Battery Assembly · End of Line</span>
          </div>
        </div>
        <div className="topbar__context">
          <div className="plant-select">
            <Factory size={17} />
            <span>
              <small>PLANT</small>
              Factory 01 · Battery Module
            </span>
            <ChevronDown size={15} />
          </div>
          <div className="live-status">
            <span />
            LINE CONNECTED
          </div>
        </div>
      </header>

      <main>
        <section className="page-heading">
          <div>
            <div className="breadcrumb">QUALITY / ASSEMBLY / END OF LINE</div>
            <h1>EOL Quality Command Center</h1>
            <p>
              Live first-pass performance, defect containment, and unit-level traceability.
            </p>
          </div>
          <div className="page-heading__actions">
            <div className="updated-at">
              <span>LAST DATA POINT</span>
              <strong>
                {formatDate(latest.timestamp)} · {formatTime(latest.timestamp)}
              </strong>
            </div>
            <button
              className="icon-button"
              onClick={loadDashboard}
              aria-label="Refresh dashboard"
            >
              <RefreshCcw size={17} />
            </button>
          </div>
        </section>

        {error && (
          <div className="error-banner">
            <AlertTriangle size={17} />
            {error}
          </div>
        )}

        <section className="hero-grid">
          <article className="ftq-card">
            <div className="ftq-card__copy">
              <span className="eyebrow">LINE QUALITY PULSE</span>
              <h2>First-time quality</h2>
              <p>
                {summary.ftq >= summary.targetFtq
                  ? "The line is meeting the production quality target."
                  : "Quality is below target. Prioritize open defect containment."}
              </p>
              <div className="target-row">
                <span>Target {summary.targetFtq.toFixed(1)}%</span>
                <strong className={yieldTone}>
                  {summary.gapToTarget > 0 ? "+" : ""}
                  {summary.gapToTarget.toFixed(1)} pts
                </strong>
              </div>
            </div>
            <FtqGauge value={summary.ftq} target={summary.targetFtq} />
          </article>

          <section className="simulation-card">
            <div className="simulation-card__header">
              <div className="simulation-icon">
                <Activity size={20} />
              </div>
              <div>
                <span className="eyebrow">DIGITAL LINE SIMULATION</span>
                <h2>Generate next production cycle</h2>
              </div>
            </div>
            <p>
              Stream synthetic EOL results into the live dashboard to test quality scenarios.
            </p>
            <div className="simulation-controls">
              <label>
                Quality profile
                <select
                  value={profile}
                  onChange={(event) => setProfile(event.target.value as SimulationProfile)}
                >
                  <option value="nominal">Nominal · 94% expected FTQ</option>
                  <option value="stressed">Stressed · 72% expected FTQ</option>
                  <option value="recovery">Recovery · 98% expected FTQ</option>
                </select>
              </label>
              <label>
                Units
                <select value={count} onChange={(event) => setCount(Number(event.target.value))}>
                  <option value={8}>8</option>
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={40}>40</option>
                </select>
              </label>
            </div>
            <div className="simulation-actions">
              <button
                className="button button--primary"
                disabled={isSimulating}
                onClick={runSimulation}
              >
                {isSimulating ? <RefreshCcw className="spin" size={17} /> : <Play size={17} />}
                {isSimulating ? "Running cycle…" : "Run simulation"}
              </button>
              <button
                className="button button--ghost"
                disabled={isSimulating || data.simulationRuns === 0}
                onClick={resetSimulation}
              >
                <TimerReset size={16} />
                Reset
              </button>
              <span className="run-count">{data.simulationRuns} cycles run</span>
            </div>
          </section>
        </section>

        <section className="metrics-grid">
          <MetricCard
            icon={<ShieldCheck size={19} />}
            label="Units tested"
            value={summary.total}
            detail={`${summary.passed} passed first time`}
          />
          <MetricCard
            icon={<CircleStop size={19} />}
            label="EOL defects"
            value={summary.failed}
            detail={`${((summary.failed / summary.total) * 100).toFixed(1)}% defect rate`}
            tone={summary.failed ? "negative" : "positive"}
          />
          <MetricCard
            icon={<BatteryCharging size={19} />}
            label="Avg. capacity"
            value={summary.avgCapacity.toFixed(2)}
            unit="Ah"
            detail="Nominal target ≥ 300 Ah"
          />
          <MetricCard
            icon={<Zap size={19} />}
            label="Avg. resistance"
            value={summary.avgResistance.toFixed(4)}
            unit="mΩ"
            detail="Upper limit 0.5500 mΩ"
          />
          <MetricCard
            icon={<Thermometer size={19} />}
            label="Avg. temperature"
            value={summary.avgTemperature.toFixed(1)}
            unit="°C"
            detail="Safety limit 30.0 °C"
          />
        </section>

        <section className="analytics-grid">
          <article className="panel trend-panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">PROCESS PERFORMANCE</span>
                <h2>Rolling FTQ trend</h2>
              </div>
              <div className="legend">
                <span className="legend__actual">Actual FTQ</span>
                <span className="legend__target">Target</span>
              </div>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trend} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,.07)" />
                  <XAxis
                    dataKey="label"
                    stroke="#789092"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                  />
                  <YAxis
                    domain={[50, 100]}
                    stroke="#789092"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#102b2d",
                      border: "1px solid #28484a",
                      borderRadius: 8,
                    }}
                    formatter={(value) => [`${value}%`]}
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke="#7f9596"
                    strokeDasharray="5 5"
                    dot={false}
                    strokeWidth={1.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="ftq"
                    stroke="#00d2be"
                    strokeWidth={2.5}
                    dot={{ fill: "#00d2be", r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#ecfffc" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="panel defect-panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">DEFECT MANAGEMENT</span>
                <h2>Failure Pareto</h2>
              </div>
              <span className="open-issues">{summary.failed} OPEN</span>
            </div>
            <div className="defect-list">
              {data.defects.map((defect, index) => (
                <div className="defect-row" key={defect.code}>
                  <span className="defect-rank">{String(index + 1).padStart(2, "0")}</span>
                  <div className="defect-info">
                    <strong>{defect.label}</strong>
                    <small>{defect.processArea}</small>
                    <div className="defect-bar">
                      <span style={{ width: `${defect.percentage}%` }} />
                    </div>
                  </div>
                  <div className="defect-count">
                    <strong>{defect.count}</strong>
                    <span>{defect.percentage.toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="containment-note">
              <AlertTriangle size={17} />
              <div>
                <strong>Primary containment focus</strong>
                <span>
                  {topDefect.count
                    ? `${topDefect.label} · ${topDefect.processArea}`
                    : "No active defects"}
                </span>
              </div>
            </div>
          </article>
        </section>

        <section className="section-heading">
          <div>
            <span className="eyebrow">EQUIPMENT HEALTH</span>
            <h2>Station performance</h2>
          </div>
          <span className="threshold-note">
            <Gauge size={15} />
            Green threshold ≥ 95% FTQ
          </span>
        </section>
        <section className="station-grid">
          {data.stations.map((station) => (
            <StationCard key={station.station} station={station} />
          ))}
        </section>

        <ResultTable records={data.records} />
      </main>

      <footer>
        <span>Industrial Quality Intelligence · Simulation environment</span>
        <span>Data source: EOL battery test bench</span>
      </footer>
    </div>
  );
}
