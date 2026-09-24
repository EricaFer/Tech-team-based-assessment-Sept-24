import { useEffect, useState } from "react";
import {
  AlertOctagon,
  ArrowLeft,
  BatteryWarning,
  Box,
  CalendarClock,
  Factory,
  MapPin,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import type { EolAlarm } from "./types";

function formatAlarmTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(new Date(timestamp));
}

export function AlarmPage({
  alarms,
  onBack,
}: {
  alarms: EolAlarm[];
  onBack: () => void;
}) {
  const [selectedId, setSelectedId] = useState(alarms[0]?.alarm_id ?? "");
  const selected = alarms.find((alarm) => alarm.alarm_id === selectedId) ?? alarms[0];

  useEffect(() => {
    if (!alarms.some((alarm) => alarm.alarm_id === selectedId)) {
      setSelectedId(alarms[0]?.alarm_id ?? "");
    }
  }, [alarms, selectedId]);

  return (
    <main className="alarm-page">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to quality command center
      </button>

      <section className="alarm-page__heading">
        <div>
          <span className="eyebrow">EOL DEFECT MANAGEMENT</span>
          <h1>Active test alarms</h1>
          <p>Failed end-of-line tests requiring containment and disposition.</p>
        </div>
        <div className="alarm-summary-tile">
          <AlertOctagon size={21} />
          <span>
            <strong>{alarms.length}</strong>
            active alarms
          </span>
        </div>
      </section>

      {selected ? (
        <section className="alarm-workspace">
          <aside className="alarm-list" aria-label="Active alarms">
            <div className="alarm-list__header">
              <span>FAILED TESTS</span>
              <b>{alarms.length}</b>
            </div>
            {alarms.map((alarm) => (
              <button
                className={`alarm-list-item ${
                  alarm.alarm_id === selected.alarm_id ? "alarm-list-item--selected" : ""
                }`}
                key={alarm.alarm_id}
                onClick={() => setSelectedId(alarm.alarm_id)}
              >
                <span className={`severity-dot severity-dot--${alarm.severity.toLowerCase()}`} />
                <span className="alarm-list-item__main">
                  <strong>{alarm.title}</strong>
                  <small>
                    {alarm.station_id} · {alarm.test_id}
                  </small>
                </span>
                <time>{formatAlarmTimestamp(alarm.detected_at).split(",").at(-1)}</time>
              </button>
            ))}
          </aside>

          <article className="alarm-detail">
            <header className="alarm-detail__header">
              <div className={`alarm-detail__icon alarm-detail__icon--${selected.severity.toLowerCase()}`}>
                <BatteryWarning size={26} />
              </div>
              <div>
                <div className="alarm-detail__meta">
                  <span className={`severity-label severity-label--${selected.severity.toLowerCase()}`}>
                    {selected.severity}
                  </span>
                  <span>{selected.status}</span>
                  <span>{selected.alarm_id}</span>
                </div>
                <h2>{selected.title}</h2>
                <p>{selected.failure_code}</p>
              </div>
            </header>

            <section className="alarm-facts">
              <div>
                <CalendarClock size={17} />
                <span>
                  <small>DETECTED AT</small>
                  <strong>{formatAlarmTimestamp(selected.detected_at)}</strong>
                </span>
              </div>
              <div>
                <MapPin size={17} />
                <span>
                  <small>STATION</small>
                  <strong>{selected.station_id}</strong>
                </span>
              </div>
              <div>
                <Box size={17} />
                <span>
                  <small>MODULE / TEST</small>
                  <strong>{selected.module_serial} · {selected.test_id}</strong>
                </span>
              </div>
              <div>
                <Factory size={17} />
                <span>
                  <small>PROCESS AREA</small>
                  <strong>{selected.process_area}</strong>
                </span>
              </div>
            </section>

            <section className="measurement-card">
              <div>
                <span className="eyebrow">FAILED MEASUREMENT</span>
                <strong>{selected.measurement_name.replaceAll("_", " ")}</strong>
              </div>
              <div className="measurement-card__reading">
                <span>
                  <small>ACTUAL</small>
                  <strong>{selected.measured_value} {selected.unit}</strong>
                </span>
                <span>
                  <small>ACCEPTANCE LIMIT</small>
                  <strong>{selected.limit_operator} {selected.limit_value} {selected.unit}</strong>
                </span>
              </div>
            </section>

            <section className="recommendation-card">
              <div className="recommendation-card__icon">
                <Wrench size={20} />
              </div>
              <div>
                <span className="eyebrow">RECOMMENDED CONTAINMENT</span>
                <h3>Response guidance</h3>
                <p>{selected.recommendation}</p>
                <div className="recommendation-card__lot">
                  <ShieldAlert size={15} />
                  Hold affected genealogy: <strong>{selected.cell_lot}</strong>
                </div>
              </div>
            </section>
          </article>
        </section>
      ) : (
        <section className="no-alarms">
          <ShieldAlert size={32} />
          <h2>No active EOL alarms</h2>
          <p>All tested modules are currently within specification.</p>
        </section>
      )}
    </main>
  );
}
