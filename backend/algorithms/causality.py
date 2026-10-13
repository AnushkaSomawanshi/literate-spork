"""Happened-before analysis derived from recorded process and message edges."""
from __future__ import annotations
from typing import Any


def causal_path(events: list[dict[str, Any]], source_id: str, target_id: str) -> list[str] | None:
    by_id = {event["event_id"]: event for event in events}
    if source_id not in by_id or target_id not in by_id:
        raise ValueError("Both event IDs must exist in the current trace.")
    if source_id == target_id:
        return [source_id]
    children: dict[str, list[str]] = {event_id: [] for event_id in by_id}
    for event in events:
        for parent in event.get("parent_event_ids", []):
            if parent in children:
                children[parent].append(event["event_id"])
    stack: list[tuple[str, list[str]]] = [(source_id, [source_id])]
    visited: set[str] = set()
    while stack:
        current, path = stack.pop()
        if current in visited:
            continue
        visited.add(current)
        for child in children.get(current, []):
            if child == target_id:
                return path + [child]
            if child not in visited:
                stack.append((child, path + [child]))
    return None


def compare_events(events: list[dict[str, Any]], event_a: str, event_b: str) -> dict[str, Any]:
    path_ab = causal_path(events, event_a, event_b)
    path_ba = causal_path(events, event_b, event_a)
    if path_ab:
        relation, path = "A_BEFORE_B", path_ab
        explanation = "A directed happened-before path connects event A to event B."
    elif path_ba:
        relation, path = "B_BEFORE_A", path_ba
        explanation = "A directed happened-before path connects event B to event A."
    else:
        relation, path = "NO_CAUSAL_PATH", []
        explanation = "No causal path connects these events in the recorded trace. This is not proof of concurrency if the trace is incomplete."
    return {
        "event_a": event_a,
        "event_b": event_b,
        "relation": relation,
        "path": path,
        "explanation": explanation,
        "timestamps_alone_prove_causality": False,
    }
