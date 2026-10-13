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


async def broadcast_changes(status):
    # These are lab events only and intentionally do not mutate the live registry.
    for event in status.get("events", [])[:8]:
        if event.get("event_type") in {"NODE_SUSPECTED", "NODE_OFFLINE", "NODE_RECOVERED", "BEACON_RECEIVED"}:
            await websocket_manager.broadcast({"event_type": event["event_type"], "beacon_lab": True, **event})


@router.get("/status")
async def get_beacon_status():
    return beacon_monitor.tick()


@router.post("/config")
async def configure_beacon_monitor(request: ConfigRequest):
    try:
        result = beacon_monitor.configure(request.interval_seconds, request.suspect_after_seconds,
                                          request.offline_after_seconds)
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
    return beacon_monitor.reset()
