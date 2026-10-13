"""Vector Clock Lab API: five-node causal ordering simulation."""
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.algorithms.vector_clock import compare_vectors, vector_clock_lab

router = APIRouter(prefix="/api/algorithms/vector", tags=["Distributed Algorithms · Vector Clock"])

class EventRequest(BaseModel):
    operation: Literal["local", "send", "receive"]
    node_id: str = Field(..., description="One of SAT-01 through SAT-05")
    destination_id: str | None = None
    message_id: str | None = None
    description: str = Field(default="", max_length=180)

class CompareRequest(BaseModel):
    event_a: str | None = None
    event_b: str | None = None
    vector_a: dict[str, int] | None = None
    vector_b: dict[str, int] | None = None

@router.get("/state")
async def get_vector_state():
    return vector_clock_lab.state()

@router.post("/event")
async def create_vector_event(request: EventRequest):
    try:
        return vector_clock_lab.event(request.operation, request.node_id, request.destination_id,
                                      request.message_id, request.description)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@router.post("/compare")
async def compare_vector_events(request: CompareRequest):
    try:
        if request.event_a or request.event_b:
            if not request.event_a or not request.event_b:
                raise ValueError("event_a and event_b must both be supplied")
            return vector_clock_lab.compare_events(request.event_a, request.event_b)
        if request.vector_a is not None and request.vector_b is not None:
            return compare_vectors(request.vector_a, request.vector_b)
        raise ValueError("Supply both event IDs or both vectors")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@router.post("/scenario/{scenario_id}")
async def load_vector_scenario(scenario_id: str):
    try:
        return vector_clock_lab.scenario(scenario_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@router.post("/reset")
async def reset_vector_scenario():
    return vector_clock_lab.reset()
