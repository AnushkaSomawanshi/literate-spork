# Beacon Monitoring Lab

## Learning objective

A beacon is a periodic announcement that a node is alive and reachable. The dedicated lab demonstrates sequence-numbered announcements, timeout-based suspicion, offline classification, and recovery. It is separate from the production heartbeat registry so that an experiment cannot accidentally mark a real satellite offline.

## Beacon payload

Each generated beacon contains `satellite_id`, monotonically increasing per-node `sequence`, a send timestamp, sender status, optional `leader_id` and `leader_term`, and a compact telemetry summary.

## Detection state machine

- **ACTIVE** — time since the last accepted beacon is below the suspicion threshold.
- **SUSPECTED** — the suspicion threshold has elapsed, but the offline threshold has not.
- **OFFLINE** — the longer timeout has elapsed.
- **Recovery** — a fresh beacon is received; state returns to ACTIVE.

For elapsed time `t`, suspicion threshold `S`, and offline threshold `O`, the rule is ACTIVE when `t < S`, SUSPECTED when `S <= t < O`, and OFFLINE when `t >= O`. Configuration is valid only when `interval > 0` and `0 < S < O`.

Timeouts indicate suspicion, not mathematical proof of a crash: network delay, loss, scheduling pauses, or congestion can look like failure. Production implementations should authenticate messages and define a replay/duplicate policy; this educational simulator uses a per-node increasing sequence.

## Demo defaults

Beacon interval 2 seconds, suspect after 6 seconds, offline after 12 seconds. These are teaching defaults, not universal protocol constants. The simulator uses monotonic elapsed time and an injectable clock for deterministic boundary tests.

## API

- `GET /api/algorithms/beacon/status`
- `POST /api/algorithms/beacon/config`
- `POST /api/algorithms/beacon/simulate` with `satellite_id`, `action` (`pause`, `resume`, `send`, `advance`) and optional `seconds`
- `POST /api/algorithms/beacon/reset`

This is a controlled simulation. Pausing a node stops only its lab beacons; other nodes continue producing announcements. It does not stop Docker containers or change production registry health.

## Tests

Run `pytest tests/test_beacon_monitor.py`. The tests cover threshold boundaries, independent nodes, recovery, validation, and sequence advancement.
