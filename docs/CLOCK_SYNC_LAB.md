# Mission Timeline Integrity Lab — Clock Synchronization

## Purpose

This lab demonstrates the Berkeley clock synchronization algorithm in the Distributed Satellite Monitoring & Mission Control System. Five satellite nodes have simulated clock offsets. Mission Control estimates a common offset, calculates per-node corrections, applies them to simulated state, and verifies the resulting spread.

The lab intentionally creates two events whose displayed order is wrong before synchronization:

- SAT-03 detects a thermal anomaly at 10:00:00.500 scenario time.
- SAT-04 receives a relay event at 10:00:00.650 scenario time.

With the default offsets (+500 ms on SAT-03 and -300 ms on SAT-04), the unsynchronized timestamps show the relay at 10:00:00.350 and the anomaly at 10:00:01.000. After the default Berkeley round, every responding clock has offset +70 ms, so the anomaly displays at 10:00:00.570 and the relay at 10:00:00.720.

## Run

The lab is available as Mission Timeline Integrity in the frontend sidebar, or directly at /clock-sync.

With the Docker Compose stack running, rebuild/restart after pulling the feature branch:

    docker compose up -d --build

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/algorithms/clock-sync/status | Current offsets and latest result |
| POST | /api/algorithms/clock-sync/run | Run one synchronization round |
| POST | /api/algorithms/clock-sync/reset | Restore the deterministic baseline |
| POST | /api/algorithms/clock-sync/scenario | Configure simulated offsets |

Run with every satellite responding:

    curl -X POST http://localhost:8000/api/algorithms/clock-sync/run -H "Content-Type: application/json" -d '{"unavailable_satellites":[]}'

Simulate a non-responsive satellite:

    curl -X POST http://localhost:8000/api/algorithms/clock-sync/run -H "Content-Type: application/json" -d '{"unavailable_satellites":["SAT-03"]}'

## Verification

Run the algorithm tests with:

    pytest tests/test_clock_sync_algorithm.py

The tests verify the default 800 ms spread, +70 ms target, per-satellite adjustments, corrected event order, excluded-node behavior, and deterministic reset.

## Correctness notes

- Clock values are simulated; the lab never changes the host or container operating-system clock.
- Spread is the maximum offset minus the minimum offset across responding satellites.
- The default zero residual spread is a result of the idealized simulation, not a claim about real network clocks.
- A satellite that does not respond is excluded from the round and retains its previous offset. The UI explicitly identifies it.
- Physical clock synchronization does not establish causality for all distributed events. Lamport and vector clocks address logical ordering and causality separately.
