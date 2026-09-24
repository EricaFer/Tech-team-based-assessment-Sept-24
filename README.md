# EOL Quality Command Center

A Siemens-style industrial dashboard for monitoring battery-module assembly end-of-line quality. The application calculates first-time quality (FTQ), highlights defects and station performance, and provides unit-level test traceability.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The Express simulation API runs on `http://localhost:4173`.

## Simulation

Use **Run simulation** on the dashboard to add a new production cycle. Three profiles are available:

- **Nominal** — approximately 94% expected FTQ
- **Stressed** — approximately 72% expected FTQ
- **Recovery** — approximately 98% expected FTQ

Simulation data is held in memory. **Reset** restores the original records from `eol_test_results_mock_sample.csv`.

## Alarm service

Every failed EOL test generates an active alarm containing the test timestamp, failure code, station, measured value, acceptance limit, and recommended containment action.

- `GET /api/alarms` — retrieve active alarms
- `/alarms` — open the alarm investigation view
- `schemas/eol-alarm.schema.json` — JSON Schema for alarm integrations

## Commands

- `npm run dev` — start the dashboard and API in watch mode
- `npm run build` — type-check and create a production build
- `npm start` — serve the API and built dashboard
- `npm test` — run automated tests

FTQ is calculated as:

```text
first-pass units / total tested units × 100
```
