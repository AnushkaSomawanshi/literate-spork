import pytest
from backend.algorithms.mutual_exclusion import MutualExclusionLab, SATELLITES


def test_idle_lab_starts_with_resource_available_and_safety_invariant():
    lab = MutualExclusionLab()
    state = lab.state()
    assert state["resource_available"] is True
    assert state["resource_owner"] is None
    assert state["safety_ok"] is True
    assert set(state["processes"]) == set(SATELLITES)


def test_request_gets_four_permissions_before_entering_critical_section():
    lab = MutualExclusionLab()
    state = lab.request_access("SAT-01")
    assert state["resource_owner"] == "SAT-01"
    assert state["processes"]["SAT-01"]["permissions_count"] == 4
    assert state["processes"]["SAT-01"]["in_critical_section"] is True
    assert state["safety_ok"] is True


def test_non_owner_cannot_release_shared_resource():
    lab = MutualExclusionLab()
    lab.request_access("SAT-01")
    with pytest.raises(ValueError):
        lab.release_access("SAT-02")


def test_release_frees_resource_and_records_release():
    lab = MutualExclusionLab()
    lab.request_access("SAT-01")
    state = lab.release_access("SAT-01")
    assert state["resource_owner"] is None
    assert state["resource_available"] is True
    assert any(event["type"] == "RELEASE" for event in state["events"])
    assert state["safety_ok"] is True


def test_second_request_waits_while_first_holds_resource():
    lab = MutualExclusionLab()
    lab.request_access("SAT-01")
    state = lab.request_access("SAT-03")
    assert state["resource_owner"] == "SAT-01"
    assert state["processes"]["SAT-03"]["in_critical_section"] is False
    assert state["safety_ok"] is True
    state = lab.release_access("SAT-01")
    assert state["safety_ok"] is True


def test_duplicate_active_request_is_rejected():
    lab = MutualExclusionLab()
    lab.request_access("SAT-01")
    with pytest.raises(ValueError):
        lab.request_access("SAT-01")


def test_simultaneous_request_scenario_explains_protocol_traffic():
    lab = MutualExclusionLab()
    state = lab.simultaneous_scenario()
    assert state["event_count"] > 0
    assert any(e["type"] == "REQUEST" for e in state["events"])
    assert any(e["type"] in ("REPLY", "DEFER") for e in state["events"])
    assert state["safety_ok"] is True
