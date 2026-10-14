"""Ricart-Agrawala mutual exclusion simulation for the five-satellite mission lab.

This is an educational in-memory simulation, not a fault-tolerant production lock.
"""
from copy import deepcopy

SATELLITES = ("SAT-01", "SAT-02", "SAT-03", "SAT-04", "SAT-05")


class MutualExclusionLab:
    """Small deterministic Ricart-Agrawala model with explicit protocol evidence."""

    def __init__(self):
        self.reset()

    def reset(self):
        self.logical_clock = {node: 0 for node in SATELLITES}
        self.processes = {
            node: {"requesting": False, "in_critical_section": False,
                   "request_timestamp": None, "replies_received": [], "deferred_replies": []}
            for node in SATELLITES
        }
        self.events = []
        self._event_number = 0
        self.resource_owner = None
        self._requests = {}
        return self.state()

    def _require_node(self, node):
        if node not in SATELLITES:
            raise ValueError(f"Unknown satellite: {node}")

    def _record(self, node, kind, message, **details):
        self._event_number += 1
        event = {"event_id": f"MX-{self._event_number:03d}", "sequence": self._event_number,
                 "satellite": node, "type": kind, "message": message, **details}
        self.events.append(event)
        return deepcopy(event)

    @staticmethod
    def _priority(timestamp, node):
        return (timestamp, node)

    def request_access(self, node, description="Request priority uplink access"):
        self._require_node(node)
        p = self.processes[node]
        if p["requesting"] or p["in_critical_section"]:
            raise ValueError(f"{node} already has an active resource request")
        self.logical_clock[node] += 1
        timestamp = self.logical_clock[node]
        p.update(requesting=True, request_timestamp=timestamp, replies_received=[], deferred_replies=[])
        self._requests[node] = {"timestamp": timestamp, "description": description}
        self._record(node, "REQUEST", f"{node} broadcasts REQUEST for priority uplink", timestamp=timestamp,
                     recipients=[n for n in SATELLITES if n != node])
        # Simulate each peer receiving the broadcast. Replies are explicit ledger events.
        for peer in SATELLITES:
            if peer == node:
                continue
            self.logical_clock[peer] = max(self.logical_clock[peer], timestamp) + 1
            q = self.processes[peer]
            peer_has_priority = (
                q["requesting"] and q["request_timestamp"] is not None
                and self._priority(q["request_timestamp"], peer) < self._priority(timestamp, node)
            )
            if q["in_critical_section"] or peer_has_priority:
                q["deferred_replies"].append(node)
                self._record(peer, "DEFER", f"{peer} defers REPLY to {node}; its own request has priority",
                             request_for=node, request_timestamp=timestamp)
            else:
                p["replies_received"].append(peer)
                self._record(peer, "REPLY", f"{peer} grants permission to {node}",
                             request_for=node, request_timestamp=timestamp)
        self._try_enter(node)
        return {"state": self.state(), "requesting_satellite": node}

    def _try_enter(self, node):
        p = self.processes[node]
        if p["requesting"] and not p["in_critical_section"] and len(p["replies_received"]) == len(SATELLITES) - 1:
            if self.resource_owner is None:
                p["in_critical_section"] = True
                self.resource_owner = node
                self._record(node, "ENTER", f"{node} enters critical section: exclusive uplink control granted",
                             request_timestamp=p["request_timestamp"],
                             permissions=len(p["replies_received"]))
                return True
        return False

    def release_access(self, node):
        self._require_node(node)
        p = self.processes[node]
        if self.resource_owner != node or not p["in_critical_section"]:
            raise ValueError(f"{node} does not currently own the shared uplink")
        p.update(requesting=False, in_critical_section=False, request_timestamp=None, replies_received=[])
        self.resource_owner = None
        self._record(node, "RELEASE", f"{node} releases priority uplink; deferred permissions are sent",
                     deferred_count=len(p["deferred_replies"]))
        deferred = list(p["deferred_replies"])
        p["deferred_replies"] = []
        for requester in deferred:
            requester_state = self.processes[requester]
            if requester_state["requesting"] and node not in requester_state["replies_received"]:
                requester_state["replies_received"].append(node)
                self._record(node, "REPLY", f"{node} sends deferred REPLY to {requester}",
                             request_for=requester)
                self._try_enter(requester)
        # Any already-permitted waiting process can enter once the owner is free.
        for candidate in SATELLITES:
            self._try_enter(candidate)
        return self.state()

    def simultaneous_scenario(self):
        self.reset()
        # Start requests at independent nodes with ordered timestamps; protocol priority is
        # still evaluated by (Lamport timestamp, satellite ID), not a central resource queue.
        self.request_access("SAT-01", "Emergency thermal alert uplink")
        self.request_access("SAT-03", "High-resolution image upload")
        self.request_access("SAT-05", "Routine telemetry batch")
        return self.state()

    def state(self):
        processes = deepcopy(self.processes)
        for node, p in processes.items():
            p["permissions_needed"] = len(SATELLITES) - 1
            p["permissions_count"] = len(p["replies_received"])
            p["status"] = ("IN CRITICAL SECTION" if p["in_critical_section"] else
                           "REQUESTING" if p["requesting"] else "IDLE")
        return {"satellites": list(SATELLITES), "logical_clock": dict(self.logical_clock),
                "processes": processes, "resource_owner": self.resource_owner,
                "resource_available": self.resource_owner is None, "events": deepcopy(self.events),
                "event_count": len(self.events),
                "safety_ok": sum(p["in_critical_section"] for p in self.processes.values()) <= 1}


mutual_exclusion_lab = MutualExclusionLab()
