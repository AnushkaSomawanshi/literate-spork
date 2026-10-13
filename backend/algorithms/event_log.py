"""Deterministic incident trace and append-only event ledger for Lamport experiments."""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from threading import RLock
from typing import Any
import time

from backend.algorithms.lamport_clock import LamportClock

SATELLITES = ("SAT-01", "SAT-02", "SAT-03", "SAT-04", "SAT-05")
SCENARIOS = {
    "thermal-alert": {
        "id": "thermal-alert",
        "name": "Thermal Alert / Emergency Imaging",
        "incident_id": "INC-2048",
        "summary": "Reconstruct a thermal alert relayed from SAT-01 to SAT-03 and SAT-05 while simulated physical clocks disagree.",
        "steps": [
            {"node_id": "SAT-01", "event_type": "local", "description": "Thermal anomaly detected", "physical_timestamp": "10:00:01.800", "kind": "anomaly"},
            {"node_id": "SAT-01", "event_type": "send", "message_id": "MSG-THERMAL-001", "destination_id": "SAT-03", "description": "Send thermal alert to SAT-03", "physical_timestamp": "10:00:01.900", "kind": "send"},
            {"node_id": "SAT-03", "event_type": "local", "description": "Payload calibration check", "physical_timestamp": "10:00:00.900", "kind": "local"},
            {"node_id": "SAT-03", "event_type": "local", "description": "Attitude-control status sampled", "physical_timestamp": "10:00:01.000", "kind": "local"},
            {"node_id": "SAT-02", "event_type": "local", "description": "Independent ocean-observation recorded", "physical_timestamp": "10:00:01.300", "kind": "independent"},
            {"node_id": "SAT-03", "event_type": "receive", "message_id": "MSG-THERMAL-001", "description": "Receive thermal alert from SAT-01", "physical_timestamp": "10:00:01.200", "kind": "receive"},
            {"node_id": "SAT-03", "event_type": "send", "message_id": "MSG-IMAGING-001", "destination_id": "SAT-05", "description": "Send emergency imaging request to SAT-05", "physical_timestamp": "10:00:02.200", "kind": "send"},
            {"node_id": "SAT-05", "event_type": "receive", "message_id": "MSG-IMAGING-001", "description": "Receive emergency imaging request", "physical_timestamp": "10:00:02.050", "kind": "receive"},
            {"node_id": "SAT-05", "event_type": "local", "description": "Imaging payload acknowledges readiness", "physical_timestamp": "10:00:02.100", "kind": "local"},
            {"node_id": "SAT-05", "event_type": "send", "message_id": "MSG-ACK-001", "destination_id": "SAT-03", "description": "Send imaging-ready acknowledgement", "physical_timestamp": "10:00:02.110", "kind": "send"},
            {"node_id": "SAT-03", "event_type": "receive", "message_id": "MSG-ACK-001", "description": "Receive imaging-ready acknowledgement", "physical_timestamp": "10:00:01.500", "kind": "receive"}
        ]
    }
}


class EventLog:
    """In-memory, deterministic lab state. Each event is committed before it is broadcast."""

    def __init__(self) -> None:
        self._lock = RLock()
        self.reset()

    def reset(self) -> dict[str, Any]:
        with self._lock:
            self.scenario_id = "thermal-alert"
            self.incident = deepcopy(SCENARIOS[self.scenario_id])
            self.clocks = {node: LamportClock() for node in SATELLITES}
            self.events: list[dict[str, Any]] = []
            self.messages: dict[str, dict[str, Any]] = {}
            self.step_index = 0
            self.started = False
            self.created_at = datetime.now(timezone.utc).isoformat()
            self.run_id = f"TRACE-{int(time.time() * 1000)}"
            return self.status()

    def list_incidents(self) -> dict[str, Any]:
        return {"incidents": [
            {"id": item["id"], "incident_id": item["incident_id"], "name": item["name"], "summary": item["summary"]}
            for item in SCENARIOS.values()
        ]}

    def start(self, scenario_id: str = "thermal-alert") -> dict[str, Any]:
        if scenario_id not in SCENARIOS:
            raise ValueError(f"Unknown incident scenario: {scenario_id}")
        with self._lock:
            self.reset()
            self.scenario_id = scenario_id
            self.incident = deepcopy(SCENARIOS[scenario_id])
            self.started = True
            return self.trace()

    def status(self) -> dict[str, Any]:
        return {
            "run_id": getattr(self, "run_id", ""),
            "scenario_id": getattr(self, "scenario_id", "thermal-alert"),
            "incident": deepcopy(getattr(self, "incident", SCENARIOS["thermal-alert"])),
            "started": getattr(self, "started", False),
            "step_index": getattr(self, "step_index", 0),
            "total_steps": len(getattr(self, "incident", SCENARIOS["thermal-alert"])["steps"]),
            "complete": self.step_index >= len(self.incident["steps"]),
            "clocks": {node: clock.snapshot() for node, clock in getattr(self, "clocks", {}).items()},
            "event_count": len(getattr(self, "events", [])),
        }

    def _last_local_parent(self, node_id: str) -> str | None:
        for event in reversed(self.events):
            if event["node_id"] == node_id:
                return event["event_id"]
        return None

    def record_event(
        self,
        node_id: str,
        event_type: str,
        description: str = "",
        message_id: str | None = None,
        destination_id: str | None = None,
        physical_timestamp: str | None = None,
        kind: str | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            if node_id not in self.clocks:
                raise ValueError(f"Unknown satellite: {node_id}")
            if event_type not in {"local", "send", "receive"}:
                raise ValueError("event_type must be local, send, or receive")
            if event_type == "send":
                if not message_id:
                    raise ValueError("A send event requires message_id.")
                if message_id in self.messages:
                    raise ValueError(f"Message {message_id} already exists.")
                if destination_id not in self.clocks or destination_id == node_id:
                    raise ValueError("A send event requires a different, known destination_id.")
            if event_type == "receive":
                if not message_id or message_id not in self.messages:
                    raise ValueError("Receive requires a message_id with a recorded send event.")
                message = self.messages[message_id]
                if message["destination_id"] != node_id:
                    raise ValueError("Receiving satellite does not match the message destination.")
                if message.get("received_by"):
                    raise ValueError(f"Message {message_id} has already been received.")

            parents: list[str] = []
            local_parent = self._last_local_parent(node_id)
            if local_parent:
                parents.append(local_parent)

            if event_type == "receive":
                message = self.messages[message_id]
                sender_event_id = message["send_event_id"]
                if sender_event_id not in parents:
                    parents.append(sender_event_id)
                clock_before, logical_timestamp = self.clocks[node_id].receive_event(message["logical_timestamp"])
            elif event_type == "send":
                clock_before, logical_timestamp = self.clocks[node_id].send_event()
            else:
                clock_before, logical_timestamp = self.clocks[node_id].local_event()

            event_id = f"E-{len(self.events) + 1:03d}"
            event = {
                "event_id": event_id,
                "run_id": self.run_id,
                "node_id": node_id,
                "process_sequence": sum(1 for item in self.events if item["node_id"] == node_id) + 1,
                "event_type": event_type,
                "kind": kind or event_type,
                "description": description or f"{event_type.title()} event on {node_id}",
                "clock_before": clock_before,
                "logical_timestamp": logical_timestamp,
                "physical_timestamp": physical_timestamp or datetime.now(timezone.utc).isoformat(),
                "message_id": message_id,
                "destination_id": destination_id if event_type == "send" else (self.messages[message_id]["source_id"] if event_type == "receive" else None),
                "parent_event_ids": parents,
                "recorded_at": datetime.now(timezone.utc).isoformat(),
            }
            self.events.append(event)
            if event_type == "send":
                self.messages[message_id] = {
                    "message_id": message_id,
                    "source_id": node_id,
                    "destination_id": destination_id,
                    "logical_timestamp": logical_timestamp,
                    "send_event_id": event_id,
                    "receive_event_id": None,
                    "received_by": None,
                }
            elif event_type == "receive":
                self.messages[message_id]["receive_event_id"] = event_id
                self.messages[message_id]["received_by"] = node_id
            return deepcopy(event)

    def step(self) -> dict[str, Any]:
        with self._lock:
            if not self.started:
                self.start("thermal-alert")
            if self.step_index >= len(self.incident["steps"]):
                return {"complete": True, "event": None, "trace": self.trace()}
            plan = self.incident["steps"][self.step_index]
            event = self.record_event(**plan)
            self.step_index += 1
            return {"complete": self.step_index >= len(self.incident["steps"]), "event": event, "trace": self.trace()}

    def run_all(self) -> dict[str, Any]:
        with self._lock:
            if not self.started:
                self.start("thermal-alert")
            while self.step_index < len(self.incident["steps"]):
                self.step()
            return self.trace()

    def _edges(self) -> list[dict[str, str]]:
        edges = []
        seen = set()
        for event in self.events:
            for parent_id in event["parent_event_ids"]:
                pair = (parent_id, event["event_id"])
                if pair not in seen:
                    edges.append({"from": parent_id, "to": event["event_id"], "kind": "message" if self._is_message_edge(parent_id, event["event_id"]) else "process"})
                    seen.add(pair)
        return edges

    def _is_message_edge(self, parent_id: str, child_id: str) -> bool:
        child = next((e for e in self.events if e["event_id"] == child_id), None)
        return bool(child and child["event_type"] == "receive" and child.get("message_id") and self.messages.get(child["message_id"], {}).get("send_event_id") == parent_id)

    def trace(self) -> dict[str, Any]:
        with self._lock:
            return {
                **self.status(),
                "events": deepcopy(self.events),
                "messages": deepcopy(list(self.messages.values())),
                "edges": self._edges(),
                "physical_order": [e["event_id"] for e in sorted(self.events, key=lambda e: (e["physical_timestamp"], e["event_id"]))],
                "logical_trace_order": [e["event_id"] for e in self.events],
                "scenario_steps": deepcopy(self.incident["steps"]),
            }


event_log = EventLog()
