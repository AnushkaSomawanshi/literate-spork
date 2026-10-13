"""Beacon monitoring state machine for the interactive mission-control teaching lab.

This lab is deliberately isolated from the production heartbeat registry: pausing a
simulated beacon never changes a satellite's real registry/health status.
"""
from __future__ import annotations

import time
from copy import deepcopy
from typing import Callable

SATELLITES = ("SAT-01", "SAT-02", "SAT-03", "SAT-04", "SAT-05")
DEFAULT_CONFIG = {"interval_seconds": 2.0, "suspect_after_seconds": 6.0, "offline_after_seconds": 12.0}


class BeaconMonitor:
    def __init__(self, clock: Callable[[], float] | None = None):
        self._clock = clock or time.monotonic
        self._time_offset = 0.0
        self.reset()

    def _now(self) -> float:
        return self._clock() + self._time_offset

    def configure(self, interval_seconds: float, suspect_after_seconds: float, offline_after_seconds: float):
        values = (interval_seconds, suspect_after_seconds, offline_after_seconds)
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) for v in values):
            raise ValueError("All timing values must be numbers.")
        if interval_seconds <= 0:
            raise ValueError("Beacon interval must be greater than zero.")
        if not (0 < suspect_after_seconds < offline_after_seconds):
            raise ValueError("Thresholds must satisfy 0 < suspicion timeout < offline timeout.")
        self.config = {"interval_seconds": float(interval_seconds),
                       "suspect_after_seconds": float(suspect_after_seconds),
                       "offline_after_seconds": float(offline_after_seconds)}
        now = self._now()
        for node in self.nodes.values():
            node["next_emit_at"] = now + self.config["interval_seconds"]
        self._record("CONFIG_UPDATED", None, "Beacon timing configuration updated.")
        return self.status()

    def reset(self):
        now = self._now()
        self.config = dict(DEFAULT_CONFIG)
        self.nodes = {}
        self.events = []
        self._event_sequence = getattr(self, '_event_sequence', 0)
        self._started_at = now
        for index, satellite_id in enumerate(SATELLITES):
            self.nodes[satellite_id] = {
                "satellite_id": satellite_id, "sequence": 0, "state": "ACTIVE",
                "paused": False, "last_received_at": now, "next_emit_at": now,
                "leader_id": "SAT-05", "leader_term": 1,
                "telemetry": {"battery": 96 - index, "temperature": 24 + index,
                              "signal_strength": 98 - index * 2},
                "last_payload": None,
            }
        self._record("LAB_RESET", None, "Beacon lab reset; all simulated nodes start ACTIVE.")
        self.tick()
        return self.status()

    def _record(self, event_type: str, satellite_id: str | None, message: str, **extra):
        self._event_sequence += 1
        self.events.append({"event_id": f"BCN-{self._event_sequence:04d}",
                            "event_type": event_type, "satellite_id": satellite_id,
                            "elapsed_seconds": round(max(0.0, self._now() - self._started_at), 2),
                            "message": message, **extra})
        self.events = self.events[-120:]

    def _receive(self, node, now):
        node["sequence"] += 1
        payload = {
            "satellite_id": node["satellite_id"], "sequence": node["sequence"],
            "send_timestamp": round(now, 3), "status": "ACTIVE",
            "leader_id": node["leader_id"], "leader_term": node["leader_term"],
            "telemetry": dict(node["telemetry"]),
        }
        node["last_received_at"] = now
        node["last_payload"] = payload
        self._record("BEACON_RECEIVED", node["satellite_id"],
                     f"Fresh beacon #{node['sequence']} received.", sequence=node["sequence"], payload=payload)

    def tick(self):
        now = self._now()
        for node in self.nodes.values():
            if not node["paused"] and now >= node["next_emit_at"]:
                self._receive(node, now)
                node["next_emit_at"] = now + self.config["interval_seconds"]
            elapsed = max(0.0, now - node["last_received_at"])
            previous = node["state"]
            if elapsed >= self.config["offline_after_seconds"]:
                current = "OFFLINE"
            elif elapsed >= self.config["suspect_after_seconds"]:
                current = "SUSPECTED"
            else:
                current = "ACTIVE"
            if current != previous:
                node["state"] = current
                event_type = {"ACTIVE": "NODE_RECOVERED", "SUSPECTED": "NODE_SUSPECTED", "OFFLINE": "NODE_OFFLINE"}[current]
                message = {
                    "ACTIVE": "A fresh beacon arrived; node recovered to ACTIVE.",
                    "SUSPECTED": "Beacon deadline exceeded; node is suspected, not proven failed.",
                    "OFFLINE": "Offline timeout exceeded without a fresh beacon.",
                }[current]
                self._record(event_type, node["satellite_id"], message,
                             elapsed_since_beacon=round(elapsed, 2))
        return self.status()

    def simulate(self, satellite_id: str, action: str, seconds: float = 1.0):
        if satellite_id not in self.nodes:
            raise ValueError(f"Unknown satellite: {satellite_id}")
        if action not in {"pause", "resume", "send", "advance"}:
            raise ValueError("action must be pause, resume, send, or advance")
        if action == "advance":
            if isinstance(seconds, bool) or not isinstance(seconds, (int, float)) or not 0 < seconds <= 300:
                raise ValueError("Advance seconds must be greater than 0 and at most 300.")
            self._time_offset += float(seconds)
            self._record("SIMULATION_ADVANCED", satellite_id, f"Simulation clock advanced by {seconds:g}s.")
            self.tick()
        elif action == "pause":
            node = self.nodes[satellite_id]
            if not node["paused"]:
                node["paused"] = True
                self._record("BEACON_TRANSMISSION_PAUSED", satellite_id, "Beacon transmitter paused by operator.")
        elif action == "resume":
            node = self.nodes[satellite_id]
            now = self._now()
            elapsed_before_recovery = max(0.0, now - node["last_received_at"])
            was_unhealthy = elapsed_before_recovery >= self.config["suspect_after_seconds"]
            node["paused"] = False
            self._receive(node, now)
            node["next_emit_at"] = now + self.config["interval_seconds"]
            node["state"] = "ACTIVE"
            if was_unhealthy:
                self._record("NODE_RECOVERED", satellite_id, "Fresh sequence received; node recovered to ACTIVE.")
        elif action == "send":
            self._receive(self.nodes[satellite_id], self._now())
            self.nodes[satellite_id]["state"] = "ACTIVE"
        return self.status()

    def status(self):
        now = self._now()
        nodes = []
        for original in self.nodes.values():
            node = deepcopy(original)
            elapsed = max(0.0, now - node["last_received_at"])
            node["seconds_since_beacon"] = round(elapsed, 2)
            node["next_deadline_seconds"] = round(max(0.0, self.config["suspect_after_seconds"] - elapsed), 2)
            node["state"] = ("OFFLINE" if elapsed >= self.config["offline_after_seconds"] else
                             "SUSPECTED" if elapsed >= self.config["suspect_after_seconds"] else "ACTIVE")
            nodes.append(node)
        counts = {state: sum(n["state"] == state for n in nodes) for state in ("ACTIVE", "SUSPECTED", "OFFLINE")}
        return {"config": dict(self.config), "nodes": nodes, "counts": counts,
                "events": deepcopy(list(reversed(self.events[-60:]))),
                "simulation_elapsed_seconds": round(max(0.0, now - self._started_at), 2),
                "protocol_note": "Missing beacons are failure suspicions; network delay or loss can mimic a failed node."}


beacon_monitor = BeaconMonitor()
