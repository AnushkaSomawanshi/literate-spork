import pytest
from backend.algorithms.vector_clock import SATELLITES, VectorClock, VectorClockLab, compare_vectors

def test_all_five_nodes_start_at_zero_and_local_event_increments_only_owner():
    clock = VectorClock()
    assert clock.snapshot() == {node: 0 for node in SATELLITES}
    assert clock.increment("SAT-02") == {"SAT-01": 0, "SAT-02": 1, "SAT-03": 0, "SAT-04": 0, "SAT-05": 0}

def test_receive_merges_componentwise_max_then_increments_receiver():
    lab = VectorClockLab()
    lab.local_event("SAT-03")
    lab.local_event("SAT-03")
    sent = lab.send_message("SAT-01", "SAT-03")
    assert list(sent["message"]["vector"].values()) == [1, 0, 0, 0, 0]
    received = lab.receive_message("SAT-03", sent["message"]["message_id"])
    assert list(received["event"]["merged_vector"].values()) == [1, 0, 2, 0, 0]
    assert list(received["event"]["vector"].values()) == [1, 0, 3, 0, 0]

def test_send_payload_is_an_immutable_snapshot():
    lab = VectorClockLab()
    sent = lab.send_message("SAT-01", "SAT-03")
    lab.local_event("SAT-01")
    assert sent["message"]["vector"]["SAT-01"] == 1
    assert lab.state()["vectors"]["SAT-01"]["SAT-01"] == 2

def test_independent_events_are_concurrent():
    lab = VectorClockLab()
    a, b = lab.local_event("SAT-01"), lab.local_event("SAT-02")
    assert compare_vectors(a["vector"], b["vector"])["relation"] == "CONCURRENT"

def test_message_receive_is_causally_after_send():
    lab = VectorClockLab()
    sent = lab.send_message("SAT-01", "SAT-03")
    received = lab.receive_message("SAT-03", sent["message"]["message_id"])
    assert lab.compare_events(sent["event"]["event_id"], received["event"]["event_id"])["relation"] == "A_BEFORE_B"

def test_comparison_reverse_order_and_equal_vectors():
    a = {"SAT-01": 2, "SAT-02": 0, "SAT-03": 0, "SAT-04": 0, "SAT-05": 0}
    b = {"SAT-01": 1, "SAT-02": 0, "SAT-03": 0, "SAT-04": 0, "SAT-05": 0}
    assert compare_vectors(a, b)["relation"] == "B_BEFORE_A"
    equal = {node: 1 for node in SATELLITES}
    assert compare_vectors(equal, equal)["relation"] == "EQUAL"

def test_invalid_nodes_vectors_messages_and_duplicate_delivery_are_rejected():
    lab = VectorClockLab()
    with pytest.raises(ValueError):
        lab.local_event("SAT-99")
    with pytest.raises(ValueError):
        compare_vectors({"SAT-01": 0}, {"SAT-01": 0})
    with pytest.raises(ValueError):
        lab.receive_message("SAT-03", "MSG-MISSING")
    sent = lab.send_message("SAT-01", "SAT-03")
    with pytest.raises(ValueError):
        lab.receive_message("SAT-02", sent["message"]["message_id"])
    lab.receive_message("SAT-03", sent["message"]["message_id"])
    with pytest.raises(ValueError):
        lab.receive_message("SAT-03", sent["message"]["message_id"])

def test_vector_components_are_nonnegative_integers_not_booleans():
    valid = {node: 0 for node in SATELLITES}
    with pytest.raises(ValueError):
        compare_vectors(dict(valid, **{"SAT-01": -1}), valid)
    with pytest.raises(ValueError):
        compare_vectors(dict(valid, **{"SAT-01": True}), valid)

def test_worked_example_reproduces_documented_vectors():
    result = VectorClockLab().scenario("worked-example")
    assert list(result["send_event"]["vector"].values()) == [1, 0, 0, 0, 0]
    assert list(result["receive_event"]["vector"].values()) == [1, 0, 3, 0, 0]

def test_concurrency_scenario_has_no_message_dependency():
    result = VectorClockLab().scenario("concurrency")
    assert result["comparison"]["relation"] == "CONCURRENT"
    assert result["state"]["message_count"] == 0
