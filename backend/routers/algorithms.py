"""API endpoints for the Mission Timeline Integrity Lab."""
from __future__ import annotations

from typing import Dict, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.algorithms.clock_sync import clock_sync_experiment

router = APIRouter(prefix="/api/algorithms/clock-sync", tags=["Distributed Algorithms · Clock Sync"])


class ScenarioRequest(BaseModel):
    offsets_ms: Dict[str, float] = Field(..., description="Simulated clock offsets in milliseconds")


class RunRequest(BaseModel):
    unavailable_satellites: List[str] = Field(default_factory=list, description="Satellites that do not respond in this synchronization round")


@router.get("/status")
async def get_clock_sync_status():
    """Return the current simulated clock offsets and most recent experiment."""
    return clock_sync_experiment.status()


@router.post("/run")
async def run_clock_synchronization(request: RunRequest | None = None):
    """Execute one Berkeley synchronization round over simulated clocks."""
    try:
        unavailable = request.unavailable_satellites if request else []
        return clock_sync_experiment.run(unavailable=unavailable)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/reset")
async def reset_clock_synchronization():
    """Reset offsets and the deterministic event scenario."""
    return clock_sync_experiment.reset()


@router.post("/scenario")
async def configure_clock_scenario(request: ScenarioRequest):
    """Set one or more simulated offsets and clear the previous result."""
    try:
        return clock_sync_experiment.configure(request.offsets_ms)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
