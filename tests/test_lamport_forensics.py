from backend.algorithms.causality import compare_events, causal_path
from backend.algorithms.event_log import EventLog


def complete_trace():
    log = EventLog()
    log.start("thermal-alert")
    return log, log.run_all()


def test_lamport_clock_updates_and_message_timestamps():
    _, trace = complete_trace()
    events = {event["event_id"]: event for event in trace["events"]}
    assert events["E-001"]["logical_timestamp"] == 1
    assert events["E-002"]["logical_timestamp"] == 2
    assert events["E-003"]["logical_timestamp"] == 1
    assert events["E-004"]["logical_timestamp"] == 2
    # Receiver advances beyond both its local clock and the incoming timestamp.
    assert events["E-006"]["clock_before"] == 2
    assert events["E-006"]["message_timestamp"] == 2
    assert events["E-006"]["logical_timestamp"] == max(2, events["E-006"]["message_timestamp"]) + 1 == 3
    assert events["E-008"]["logical_timestamp"] == 5
    assert events["E-011"]["logical_timestamp"] == 8


def test_send_precedes_receive_and_transitivity_is_preserved():
    _, trace = complete_trace()
    events = trace["events"]
    assert causal_path(events, "E-002", "E-006") == ["E-002", "E-006"]
    assert causal_path(events, "E-001", "E-006") is not None
    assert causal_path(events, "E-002", "E-011") is not None
    assert compare_events(events, "E-002", "E-011")["relation"] == "A_BEFORE_B"


def test_independent_satellite_event_has_no_causal_path_to_incident():
    _, trace = complete_trace()
    result = compare_events(trace["events"], "E-005", "E-002")
    assert result["relation"] == "NO_CAUSAL_PATH"
    assert result["timestamps_alone_prove_causality"] is False


def test_physical_timestamp_conflict_does_not_override_message_causality():
    _, trace = complete_trace()
    events = {event["event_id"]: event for event in trace["events"]}
    send = events["E-002"]
    receive = events["E-006"]
    assert receive["physical_timestamp"] < send["physical_timestamp"]
    assert causal_path(trace["events"], send["event_id"], receive["event_id"]) is not None


def test_invalid_receive_is_rejected():
    log = EventLog()
    log.start("thermal-alert")
    try:
        log.record_event(node_id="SAT-03", event_type="receive", message_id="MSG-NOT-SENT")
    except ValueError as exc:
        assert "recorded send event" in str(exc)
    else:
        raise AssertionError("Receive without a recorded send must be rejected.")


def test_scenario_replay_is_repeatable():
    _, first = complete_trace()
    _, second = complete_trace()
    first_projection = [(e["node_id"], e["event_type"], e["logical_timestamp"], e["message_id"]) for e in first["events"]]
    second_projection = [(e["node_id"], e["event_type"], e["logical_timestamp"], e["message_id"]) for e in second["events"]]
    assert first_projection == second_projection
    assert len(first["events"]) == 11
