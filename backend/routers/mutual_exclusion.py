"""API for the satellite shared-resource mutual exclusion lab."""
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.algorithms.mutual_exclusion import mutual_exclusion_lab

router = APIRouter(prefix="/api/algorithms/mutual-exclusion", tags=["Distributed Algorithms · Mutual Exclusion"])


class RequestAccess(BaseModel):
    satellite_id: str = Field(..., description="One of SAT-01 through SAT-05")
    description: str = Field(default="Request priority uplink access", max_length=180)


@router.get("/state")
async def get_state():
    return mutual_exclusion_lab.state()


@router.post("/request")
async def request_access(request: RequestAccess):
    try:
        return mutual_exclusion_lab.request_access(request.satellite_id, request.description)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/release/{satellite_id}")
async def release_access(satellite_id: str):
    try:
        return mutual_exclusion_lab.release_access(satellite_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/scenario/{scenario_id}")
async def load_scenario(scenario_id: Literal["simultaneous-requests"]):
    if scenario_id != "simultaneous-requests":
        raise HTTPException(status_code=404, detail="Unknown scenario")
    return mutual_exclusion_lab.simultaneous_scenario()


@router.post("/reset")
async def reset():
    return mutual_exclusion_lab.reset()
