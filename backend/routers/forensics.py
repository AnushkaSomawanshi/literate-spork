"""Mission Forensics APIs for Lamport clock event reconstruction."""
from __future__ import annotations

from typing import Literal
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.algorithms.event_log import event_log
from backend.algorithms.causality import compare_events, causal_path
from backend.communication.websocket_manager import websocket_manager

router = APIRouter(prefix="/api/algorithms/forensics", tags=["Distributed Algorithms · Mission Forensics"])


class StartRequest(BaseModel):
    scenario_id: str = "thermal-alert"


class EventRequest(BaseModel):
    node_id: str = Field(..., description="Satellite process ID")
    event_type: Literal["local", "send", "receive"]
    description: str = ""
    message_id: str | None = None
    destination_id: str | None = None
    physical_timestamp: str | None = None


class CompareRequest(BaseModel):
    event_a: str
    event_b: str


@router.get("/incidents")
async def list_incidents():
    return event_log.list_incidents()


@router.post("/incidents/{incident_id}/start")
async def start_incident(incident_id: str):
    try:
        trace = event_log.start(incident_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await websocket_manager.broadcast({"event_type": "FORENSICS_TRACE_RESET", "run_id": trace["run_id"], "trace": trace})
    return trace


@router.post("/replay/step")
async def replay_step():
    try:
        result = event_log.step()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result.get("event"):
        await websocket_manager.broadcast({
            "event_type": "LAMPORT_EVENT_RECORDED",
            "run_id": result["trace"]["run_id"],
            "event": result["event"],
            "clocks": result["trace"]["clocks"],
            "trace": result["trace"],
        })
    return result


@router.post("/replay/run")
async def replay_all():
    try:
        trace = event_log.run_all()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await websocket_manager.broadcast({"event_type": "LAMPORT_TRACE_COMPLETED", "run_id": trace["run_id"], "trace": trace})
    return trace


@router.post("/events")
async def record_event(request: EventRequest):
    try:
        event = event_log.record_event(
            node_id=request.node_id,
            event_type=request.event_type,
            description=request.description,
            message_id=request.message_id,
            destination_id=request.destination_id,
            physical_timestamp=request.physical_timestamp,
        )
        trace = event_log.trace()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await websocket_manager.broadcast({
        "event_type": "LAMPORT_EVENT_RECORDED",
        "run_id": trace["run_id"],
        "event": event,
        "clocks": trace["clocks"],
        "trace": trace,
    })
    return {"event": event, "trace": trace}


@router.get("/trace")
async def get_trace():
    return event_log.trace()


@router.get("/causality")
async def get_causality(event_a: str = Query(...), event_b: str = Query(...)):
    try:
        return compare_events(event_log.trace()["events"], event_a, event_b)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/path/{event_id}")
async def get_event_ancestors(event_id: str):
    trace = event_log.trace()
    try:
        if not any(event["event_id"] == event_id for event in trace["events"]):
            raise ValueError(f"Unknown event ID: {event_id}")
        ancestors = []
        for event in trace["events"]:
            if event["event_id"] != event_id and causal_path(trace["events"], event["event_id"], event_id):
                ancestors.append(event["event_id"])
        descendants = []
        for event in trace["events"]:
            if event["event_id"] != event_id and causal_path(trace["events"], event_id, event["event_id"]):
                descendants.append(event["event_id"])
        return {"event_id": event_id, "ancestors": ancestors, "descendants": descendants}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/report")
async def incident_report():
    trace = event_log.trace()
    by_id = {event["event_id"]: event for event in trace["events"]}
    thermal_send = next((e for e in trace["events"] if e.get("message_id") == "MSG-THERMAL-001" and e["event_type"] == "send"), None)
    thermal_receive = next((e for e in trace["events"] if e.get("message_id") == "MSG-THERMAL-001" and e["event_type"] == "receive"), None)
    independent = next((e for e in trace["events"] if e.get("kind") == "independent"), None)
    conflict = bool(thermal_send and thermal_receive and thermal_receive["physical_timestamp"] < thermal_send["physical_timestamp"])
    return {
        "run_id": trace["run_id"],
        "incident_id": trace["incident"]["incident_id"],
        "title": trace["incident"]["name"],
        "complete": trace["complete"],
        "event_count": len(trace["events"]),
        "message_count": len(trace["messages"]),
        "physical_order_conflict_detected": conflict,
        "findings": [
            {
                "id": "F-01",
                "title": "Thermal alert causal link",
                "status": "confirmed" if thermal_send and thermal_receive else "pending",
                "detail": "The send event and matching receive event establish send-before-receive order." if thermal_send and thermal_receive else "Complete the replay to establish the message link.",
                "evidence_event_ids": [e["event_id"] for e in (thermal_send, thermal_receive) if e],
            },
            {
                "id": "F-02",
                "title": "Physical-time ordering conflict",
                "status": "confirmed" if conflict else ("pending" if not trace["complete"] else "not_observed"),
                "detail": "The simulated receive timestamp sorts before the matching send timestamp; message causality still establishes send-before-receive." if conflict else "The configured trace does not currently show this conflict.",
                "evidence_event_ids": [e["event_id"] for e in (thermal_send, thermal_receive) if e],
            },
            {
                "id": "F-03",
                "title": "Independent SAT-02 observation",
                "status": "recorded" if independent else "pending",
                "detail": "No causal path to the main incident is established in this trace; do not infer causality from timestamp order alone." if independent else "The independent observation has not yet been recorded.",
                "evidence_event_ids": [independent["event_id"]] if independent else [],
            },
        ],
        "limitations": [
            "The incident uses simulated physical timestamps and does not alter operating-system clocks.",
            "A Lamport timestamp respects happened-before order, but timestamp comparison alone cannot prove causality.",
            "A missing path means no causal order is established by this trace; it is not proof of concurrency when evidence may be incomplete.",
        ],
        "event_index": {event_id: {"node_id": event["node_id"], "logical_timestamp": event["logical_timestamp"], "description": event["description"]} for event_id, event in by_id.items()},
    }
