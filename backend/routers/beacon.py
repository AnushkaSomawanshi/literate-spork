"""Beacon Monitoring Lab REST API."""
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.algorithms.beacon_monitor import beacon_monitor
from backend.communication.websocket_manager import websocket_manager

router = APIRouter(prefix="/api/algorithms/beacon", tags=["Distributed Algorithms · Beacon Monitor"])


class ConfigRequest(BaseModel):
    interval_seconds: float = Field(default=2.0, gt=0, le=60)
    suspect_after_seconds: float = Field(default=6.0, gt=0, le=300)
    offline_after_seconds: float = Field(default=12.0, gt=0, le=600)


class SimulationRequest(BaseModel):
    satellite_id: str
    action: Literal["pause", "resume", "send", "advance"]
    seconds: float = Field(default=1.0, gt=0, le=300)


_published_event_ids = set()


async def broadcast_changes(status):
    # Publish each lab event once; these never mutate the live registry.
    events = list(reversed(status.get("events", [])))
    for event in events:
        event_id = event.get("event_id")
        if event_id in _published_event_ids:
            continue
        _published_event_ids.add(event_id)
        if event.get("event_type") in {"NODE_SUSPECTED", "NODE_OFFLINE", "NODE_RECOVERED", "BEACON_RECEIVED", "BEACON_TRANSMISSION_PAUSED"}:
            await websocket_manager.broadcast({"event_type": event["event_type"], "beacon_lab": True, **event})
    if len(_published_event_ids) > 300:
        _published_event_ids.clear()
        _published_event_ids.update(event.get("event_id") for event in events if event.get("event_id"))


@router.get("/status")
async def get_beacon_status():
    result = beacon_monitor.tick()
    await broadcast_changes(result)
    return result


@router.post("/config")
async def configure_beacon_monitor(request: ConfigRequest):
    try:
        result = beacon_monitor.configure(request.interval_seconds, request.suspect_after_seconds,
                                          request.offline_after_seconds)
        await broadcast_changes(result)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/simulate")
async def simulate_beacon(request: SimulationRequest):
    try:
        result = beacon_monitor.simulate(request.satellite_id, request.action, request.seconds)
        await broadcast_changes(result)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/reset")
async def reset_beacon_lab():
    result = beacon_monitor.reset()
    await broadcast_changes(result)
    return result
