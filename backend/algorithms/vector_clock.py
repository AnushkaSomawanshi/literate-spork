"""Correct vector-clock primitives and a five-satellite teaching lab."""
from __future__ import annotations
from copy import deepcopy
from typing import Dict, Mapping
from backend.fa2_extensions.interfaces import IVectorClock

SATELLITES = ("SAT-01", "SAT-02", "SAT-03", "SAT-04", "SAT-05")
Vector = Dict[str, int]

def _validate_vector(vector: Mapping[str, int], nodes: tuple[str, ...] = SATELLITES) -> Vector:
    if set(vector.keys()) != set(nodes):
        raise ValueError(f"Vector must contain exactly these nodes: {', '.join(nodes)}")
    normalized = {}
    for node in nodes:
        value = vector[node]
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ValueError(f"Vector component for {node} must be a non-negative integer")
        normalized[node] = value
    return normalized

class VectorClock(IVectorClock):
    """Vector clock implementation behind the repository's IVectorClock interface."""
    def __init__(self, node_ids: tuple[str, ...] = SATELLITES):
        if not node_ids or len(set(node_ids)) != len(node_ids):
            raise ValueError("Node IDs must be a non-empty unique sequence")
        self.node_ids = tuple(node_ids)
        self.values = {node: 0 for node in self.node_ids}

    def increment(self, node_id: str) -> Vector:
        if node_id not in self.values:
            raise ValueError(f"Unknown satellite: {node_id}")
        self.values[node_id] += 1
        return self.snapshot()

    def merge(self, received_vector: Dict[str, int]) -> Vector:
        incoming = _validate_vector(received_vector, self.node_ids)
        self.values = {node: max(self.values[node], incoming[node]) for node in self.node_ids}
        return self.snapshot()

    def snapshot(self) -> Vector:
        return dict(self.values)

def compare_vectors(vector_a: Mapping[str, int], vector_b: Mapping[str, int]) -> dict:
    """Compare vectors using strict component-wise partial ordering."""
    a, b = _validate_vector(vector_a), _validate_vector(vector_b)
    a_le_b = all(a[n] <= b[n] for n in SATELLITES)
    b_le_a = all(b[n] <= a[n] for n in SATELLITES)
    a_strict = any(a[n] < b[n] for n in SATELLITES)
    b_strict = any(b[n] < a[n] for n in SATELLITES)
    if a_le_b and a_strict:
        relation, explanation = "A_BEFORE_B", "Every component of A is <= B and at least one is smaller."
    elif b_le_a and b_strict:
        relation, explanation = "B_BEFORE_A", "Every component of B is <= A and at least one is smaller."
    elif a == b:
        relation, explanation = "EQUAL", "The vectors are identical; equality does not prove strict happened-before."
    else:
        relation, explanation = "CONCURRENT", "Neither vector dominates the other; each has a greater component."
    return {
        "relation": relation, "vector_a": a, "vector_b": b, "explanation": explanation,
        "components": [{"node_id": n, "a": a[n], "b": b[n],
                        "a_le_b": a[n] <= b[n], "b_le_a": b[n] <= a[n]} for n in SATELLITES],
    }

class VectorClockLab:
    """In-memory event/message ledger used by the API and interactive UI."""
    def __init__(self):
        self.reset()

    def reset(self):
        self.clocks = {node: VectorClock() for node in SATELLITES}
        self.events, self.messages = [], {}
        self._event_counter = self._message_counter = 0
        return self.state()

    @staticmethod
    def _require_node(node_id):
        if node_id not in SATELLITES:
            raise ValueError(f"Unknown satellite: {node_id}")

    def _record(self, node_id, event_type, description, before, after, **extra):
        self._event_counter += 1
        event = {"event_id": f"V-{self._event_counter:03d}", "sequence": self._event_counter,
                 "node_id": node_id, "event_type": event_type, "description": description,
                 "vector_before": dict(before), "vector_after": dict(after), "vector": dict(after), **extra}
        self.events.append(event)
        return deepcopy(event)

    def local_event(self, node_id, description="Local observation recorded"):
        self._require_node(node_id)
        before = self.clocks[node_id].snapshot()
        after = self.clocks[node_id].increment(node_id)
        return self._record(node_id, "local", description, before, after)

    def send_message(self, node_id, destination_id, description="Transmit vector-clock message"):
        self._require_node(node_id)
        self._require_node(destination_id)
        if node_id == destination_id:
            raise ValueError("A message destination must differ from its source satellite")
        before = self.clocks[node_id].snapshot()
        after = self.clocks[node_id].increment(node_id)
        self._message_counter += 1
        message_id = f"MSG-{self._message_counter:03d}"
        event = self._record(node_id, "send", description, before, after,
                             message_id=message_id, destination_id=destination_id)
        message = {"message_id": message_id, "source_id": node_id, "destination_id": destination_id,
                   "vector": dict(after), "send_event_id": event["event_id"], "delivered": False}
        self.messages[message_id] = message
        return {"event": event, "message": deepcopy(message)}

    def receive_message(self, node_id, message_id, description="Merge received message"):
        self._require_node(node_id)
        message = self.messages.get(message_id)
        if message is None:
            raise ValueError(f"Unknown message {message_id}; a recorded send is required")
        if message["destination_id"] != node_id:
            raise ValueError(f"Message {message_id} is addressed to {message['destination_id']}, not {node_id}")
        if message["delivered"]:
            raise ValueError(f"Message {message_id} has already been delivered")
        before = self.clocks[node_id].snapshot()
        merged = self.clocks[node_id].merge(message["vector"])
        after = self.clocks[node_id].increment(node_id)
        event = self._record(node_id, "receive", description, before, after, merged_vector=merged,
                             message_id=message_id, source_id=message["source_id"],
                             related_event_id=message["send_event_id"])
        message["delivered"] = True
        message["receive_event_id"] = event["event_id"]
        return {"event": event, "message": deepcopy(message)}

    def event(self, operation, node_id, destination_id=None, message_id=None, description=""):
        if operation == "local":
            event = self.local_event(node_id, description or "Local observation recorded")
            return {"event": event, "state": self.state()}
        if operation == "send":
            if not destination_id:
                raise ValueError("destination_id is required for a send operation")
            result = self.send_message(node_id, destination_id, description or "Transmit vector-clock message")
            return {**result, "state": self.state()}
        if operation == "receive":
            if not message_id:
                raise ValueError("message_id is required for a receive operation")
            result = self.receive_message(node_id, message_id, description or "Merge received message")
            return {**result, "state": self.state()}
        raise ValueError("operation must be local, send, or receive")

    def scenario(self, scenario_id):
        self.reset()
        if scenario_id == "worked-example":
            self.local_event("SAT-03", "SAT-03 local observation 1")
            self.local_event("SAT-03", "SAT-03 local observation 2")
            sent = self.send_message("SAT-01", "SAT-03", "Send vector from SAT-01 to SAT-03")
            received = self.receive_message("SAT-03", sent["message"]["message_id"], "SAT-03 receives SAT-01 vector")
            return {"scenario_id": scenario_id, "state": self.state(),
                    "send_event": sent["event"], "receive_event": received["event"]}
        if scenario_id == "concurrency":
            a = self.local_event("SAT-01", "Independent event A on SAT-01")
            b = self.local_event("SAT-02", "Independent event B on SAT-02")
            comparison = compare_vectors(a["vector"], b["vector"])
            comparison.update({"event_a": a["event_id"], "event_b": b["event_id"]})
            return {"scenario_id": scenario_id, "state": self.state(), "comparison": comparison}
        raise ValueError("Unknown scenario. Use worked-example or concurrency.")

    def compare_events(self, event_a, event_b):
        lookup = {event["event_id"]: event for event in self.events}
        if event_a not in lookup or event_b not in lookup:
            raise ValueError("Both event IDs must exist in the current simulation")
        result = compare_vectors(lookup[event_a]["vector"], lookup[event_b]["vector"])
        result.update({"event_a": event_a, "event_b": event_b})
        return result

    def state(self):
        messages = [deepcopy(message) for message in self.messages.values()]
        return {"satellites": list(SATELLITES),
                "vectors": {node: clock.snapshot() for node, clock in self.clocks.items()},
                "events": deepcopy(self.events), "messages": messages,
                "event_count": len(self.events), "message_count": len(messages),
                "pending_messages": [m for m in messages if not m["delivered"]]}

vector_clock_lab = VectorClockLab()
