from backend.algorithms.causality import compare_events, causal_path
from backend.algorithms.event_log import EventLog


def complete_trace():
    log = EventLog()
    log.start("thermal-alert")
    return log, log.run_all()


def by_description(trace, description):
    return next(event for event in trace["events"] if event["description"] == description)


def test_lamport_clock_updates_and_message_timestamps():
    _, trace = complete_trace()
    anomaly = by_description(trace, "Thermal anomaly detected")
    thermal_send = by_description(trace, "Send thermal alert to SAT-03")
    thermal_receive = by_description(trace, "Receive thermal alert from SAT-01")
    assert anomaly["logical_timestamp"] == 1
    assert thermal_send["logical_timestamp"] == 2
    assert thermal_receive["clock_before"] == 7
    assert thermal_receive["message_timestamp"] == 2
    assert thermal_receive["logical_timestamp"] == max(7, 2) + 1 == 8
    imaging_receive = by_description(trace, "Receive emergency imaging request")
    assert imaging_receive["message_timestamp"] == 9
    assert imaging_receive["logical_timestamp"] == 10
    acknowledgement_receive = by_description(trace, "Receive imaging-ready acknowledgement")
    assert acknowledgement_receive["message_timestamp"] == 12
    assert acknowledgement_receive["logical_timestamp"] == 13


def test_send_precedes_receive_and_transitivity_is_preserved():
    _, trace = complete_trace()
    events = trace["events"]
    thermal_send = by_description(trace, "Send thermal alert to SAT-03")
    thermal_receive = by_description(trace, "Receive thermal alert from SAT-01")
    ack_receive = by_description(trace, "Receive imaging-ready acknowledgement")
    assert causal_path(events, thermal_send["event_id"], thermal_receive["event_id"]) == [thermal_send["event_id"], thermal_receive["event_id"]]
    assert causal_path(events, "E-001", thermal_receive["event_id"]) is not None
    assert causal_path(events, thermal_send["event_id"], ack_receive["event_id"]) is not None
    assert compare_events(events, thermal_send["event_id"], ack_receive["event_id"])["relation"] == "A_BEFORE_B"


def test_independent_satellite_event_has_no_causal_path_to_incident():
    _, trace = complete_trace()
    independent = by_description(trace, "Independent ocean-observation recorded")
    thermal_send = by_description(trace, "Send thermal alert to SAT-03")
    result = compare_events(trace["events"], independent["event_id"], thermal_send["event_id"])
    assert result["relation"] == "NO_CAUSAL_PATH"
    assert result["timestamps_alone_prove_causality"] is False


def test_physical_timestamp_conflict_does_not_override_message_causality():
    _, trace = complete_trace()
    send = by_description(trace, "Send thermal alert to SAT-03")
    receive = by_description(trace, "Receive thermal alert from SAT-01")
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
    assert len(first["events"]) == 16
