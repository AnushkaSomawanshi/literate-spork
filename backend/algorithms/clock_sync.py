"""Deterministic Berkeley clock synchronization experiment.

All clocks are simulated offsets; this module never changes OS/container time.
Event times are relative to a fixed scenario epoch so the demo is repeatable.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

DEFAULT_OFFSETS_MS = {
    "SAT-01": 200,
    "SAT-02": -150,
    "SAT-03": 500,
    "SAT-04": -300,
    "SAT-05": 100,
}

# Fixed scenario epoch: 10:00:00.000. The anomaly happens at +500 ms and
# the relay at +650 ms. These are intentionally chosen so clock skew reverses
# their displayed order before synchronization.
SCENARIO_EVENTS = [
    {
        "event_id": "EVT-THERMAL-001",
        "satellite_id": "SAT-03",
        "kind": "THERMAL_ANOMALY",
        "label": "Thermal anomaly detected",
        "true_time_ms": 500,
        "description": "SAT-03 detects a sudden temperature rise.",
    },
    {
        "event_id": "EVT-RELAY-001",
        "satellite_id": "SAT-04",
        "kind": "RELAY_RECEIVED",
        "label": "Relay received",
        "true_time_ms": 650,
        "description": "SAT-04 receives the simulated relay event.",
    },
]


def _clock_label(offset_ms: float) -> str:
    """Format a clock reading relative to 10:00:00.000."""
    base = datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
    from datetime import timedelta
    value = base + timedelta(milliseconds=offset_ms)
    return value.strftime("%H:%M:%S.") + f"{value.microsecond // 1000:03d}"


def _spread(offsets: dict[str, float]) -> float:
    return round(max(offsets.values()) - min(offsets.values()), 3) if offsets else 0.0


def _events(offsets: dict[str, float]) -> list[dict[str, Any]]:
    result = []
    for event in SCENARIO_EVENTS:
        offset = offsets.get(event["satellite_id"], 0.0)
        displayed_ms = event["true_time_ms"] + offset
        result.append({
            **event,
            "clock_offset_ms": round(offset, 3),
            "displayed_time_ms": round(displayed_ms, 3),
            "displayed_time": _clock_label(displayed_ms),
        })
    # The dashboard should show the order the clocks would lead an operator to
    # believe, not the ground-truth event order.
    return sorted(result, key=lambda item: item["displayed_time_ms"])


class ClockSyncExperiment:
    """In-memory, repeatable state for the clock-sync teaching lab."""

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> dict[str, Any]:
        self.offsets_ms = dict(DEFAULT_OFFSETS_MS)
        self.last_result: dict[str, Any] | None = None
        return self.status()

    def configure(self, offsets_ms: dict[str, float]) -> dict[str, Any]:
        if not offsets_ms:
            raise ValueError("Provide at least one satellite offset.")
        unknown = set(offsets_ms) - set(DEFAULT_OFFSETS_MS)
        if unknown:
            raise ValueError(f"Unknown satellites: {', '.join(sorted(unknown))}")
        for sat_id, offset in offsets_ms.items():
            if not isinstance(offset, (int, float)) or abs(float(offset)) > 60_000:
                raise ValueError(f"{sat_id} offset must be a number within ±60000 ms.")
        self.offsets_ms.update({key: float(value) for key, value in offsets_ms.items()})
        self.last_result = None
        return self.status()

    def status(self) -> dict[str, Any]:
        offsets = dict(self.offsets_ms)
        target = sum(offsets.values()) / len(offsets) if offsets else 0.0
        return {
            "experiment": "Mission Timeline Integrity Lab",
            "algorithm": "Berkeley clock synchronization",
            "coordinator": "Mission Control",
            "simulation_only": True,
            "synchronized": self.last_result is not None and self.last_result["success"],
            "offsets_ms": offsets,
            "target_offset_ms": round(target, 3),
            "spread_ms": _spread(offsets),
            "spread_before_ms": self.last_result["spread_before_ms"] if self.last_result else _spread(offsets),
            "spread_after_ms": self.last_result["spread_after_ms"] if self.last_result else None,
            "events": {
                "before": _events(offsets if self.last_result is None else self.last_result["offsets_before_ms"]),
                "after": self.last_result["events_after"] if self.last_result else None,
            },
            "last_result": deepcopy(self.last_result),
        }

    def run(self, unavailable: list[str] | None = None) -> dict[str, Any]:
        unavailable_ids = set(unavailable or [])
        unknown = unavailable_ids - set(self.offsets_ms)
        if unknown:
            raise ValueError(f"Unknown satellites: {', '.join(sorted(unknown))}")
        participants = {key: value for key, value in self.offsets_ms.items() if key not in unavailable_ids}
        if not participants:
            raise ValueError("Synchronization requires at least one responding satellite.")

        offsets_before = dict(self.offsets_ms)
        events_before = _events(offsets_before)
        target = sum(participants.values()) / len(participants)
        adjustments = {key: round(target - value, 3) for key, value in participants.items()}
        offsets_after = dict(offsets_before)
        for sat_id in participants:
            offsets_after[sat_id] = round(offsets_before[sat_id] + adjustments[sat_id], 3)

        # Excluded nodes retain their old offsets and are explicitly not marked
        # synchronized; their clocks must not be silently treated as corrected.
        spread_before = _spread({key: offsets_before[key] for key in participants})
        spread_after = _spread({key: offsets_after[key] for key in participants})
        success = spread_after <= 0.001
        events_after = _events(offsets_after)
        actual_order = [event["event_id"] for event in sorted(SCENARIO_EVENTS, key=lambda item: item["true_time_ms"])]
        displayed_order_before = [event["event_id"] for event in events_before]
        displayed_order_after = [event["event_id"] for event in events_after]
        result = {
            "success": success,
            "algorithm": "Berkeley clock synchronization",
            "coordinator": "Mission Control",
            "simulation_only": True,
            "participants": list(participants),
            "excluded_satellites": sorted(unavailable_ids),
            "offsets_before_ms": offsets_before,
            "offsets_after_ms": offsets_after,
            "adjustments_ms": adjustments,
            "target_offset_ms": round(target, 3),
            "spread_before_ms": spread_before,
            "spread_after_ms": spread_after,
            "events_before": events_before,
            "events_after": events_after,
            "ground_truth_order": actual_order,
            "displayed_order_before": displayed_order_before,
            "displayed_order_after": displayed_order_after,
            "timeline_order_corrected": displayed_order_after == actual_order,
            "steps": [
                {"step": 1, "title": "Collect clock estimates", "detail": f"Mission Control collected offsets from {len(participants)}/{len(offsets_before)} satellites.", "status": "complete"},
                {"step": 2, "title": "Calculate common target", "detail": f"Mean offset of responding satellites = {target:+.3f} ms.", "status": "complete"},
                {"step": 3, "title": "Distribute adjustments", "detail": f"Calculated and applied {len(adjustments)} simulated clock adjustments.", "status": "complete"},
                {"step": 4, "title": "Verify synchronization", "detail": f"Participant spread changed from {spread_before:.3f} ms to {spread_after:.3f} ms.", "status": "complete" if success else "warning"},
            ],
            "log": [
                f"Coordinator started Berkeley round with {len(offsets_before)} registered satellites.",
                f"Responses received: {len(participants)}; excluded: {', '.join(sorted(unavailable_ids)) if unavailable_ids else 'none'}.",
                f"Target offset: {target:+.3f} ms.",
                *[f"{sat_id}: {offsets_before[sat_id]:+.3f} ms → adjustment {adjustments[sat_id]:+.3f} ms → {offsets_after[sat_id]:+.3f} ms" for sat_id in participants],
                f"Verification: spread {spread_before:.3f} ms → {spread_after:.3f} ms.",
                "Mission event ordering corrected." if displayed_order_after == actual_order else "Timeline order still differs from scenario ground truth; inspect excluded nodes or remaining skew.",
            ],
        }
        self.offsets_ms = offsets_after
        self.last_result = result
        return deepcopy(result)


clock_sync_experiment = ClockSyncExperiment()
