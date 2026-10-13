# Mission Forensics Lab — Lamport Logical Clocks

## Purpose
Mission Forensics reconstructs a simulated thermal-alert incident across satellite processes. It demonstrates Lamport logical clocks, send/receive message semantics, the happened-before relation, physical timestamp skew, and the limits of timestamp-only comparisons.

## Deterministic scenario
- SAT-01 detects a thermal anomaly and sends `MSG-THERMAL-001` to SAT-03.
- SAT-03 records local operations until its clock reaches 7 before the alert arrives.
- The receive event reads the sender's message timestamp 2 and computes `max(7, 2) + 1 = 8`.
- SAT-03 sends an imaging request to SAT-05; SAT-05 receives it and sends an acknowledgement.
- SAT-02 records an independent observation with no causal path to the thermal-alert chain.
- Simulated physical timestamps deliberately place the thermal receive before the send in a wall-clock-sorted view. These are scenario labels only; no OS clocks are changed.

## API
- `GET /api/algorithms/forensics/incidents`
- `POST /api/algorithms/forensics/incidents/{incident_id}/start`
- `POST /api/algorithms/forensics/replay/step`
- `POST /api/algorithms/forensics/replay/run`
- `POST /api/algorithms/forensics/events`
- `GET /api/algorithms/forensics/trace`
- `GET /api/algorithms/forensics/causality?event_a=E-002&event_b=E-011`
- `GET /api/algorithms/forensics/path/{event_id}`
- `GET /api/algorithms/forensics/report`

Each event records its process sequence, clock-before value, logical timestamp, received message timestamp where applicable, physical timestamp label, and immediate causal predecessors. Receive events are rejected unless a matching send exists and targets that receiver.

## UI
Open `/mission-forensics`. The four workspaces are Incident briefing, Reconstruction, Causality analysis, and Evidence report. Replay controls and manual event controls call the backend; WebSocket broadcasts keep connected clients in sync. The JSON export contains the current trace and findings.

## Run and verify
From the repository root:
```bash
python -m pytest tests/test_lamport_forensics.py -v
```
From `frontend`:
```bash
npm run build
```
Or rebuild the Docker Compose services after pulling the branch:
```bash
docker compose up -d --build
```

The event ledger is in-memory and shared by the backend process. It is a deterministic educational simulation, not a durable flight recorder. A backend restart resets the lab state.
