from backend.algorithms.clock_sync import ClockSyncExperiment


def test_default_scenario_exposes_clock_skew_reversing_event_order():
    experiment = ClockSyncExperiment()
    state = experiment.status()
    assert state["spread_ms"] == 800
    assert [event["kind"] for event in state["events"]["before"]] == ["RELAY_RECEIVED", "THERMAL_ANOMALY"]


def test_berkeley_round_converges_clocks_and_corrects_timeline():
    experiment = ClockSyncExperiment()
    result = experiment.run()
    assert result["success"] is True
    assert result["target_offset_ms"] == 70
    assert result["spread_before_ms"] == 800
    assert result["spread_after_ms"] == 0
    assert result["adjustments_ms"]["SAT-03"] == -430
    assert result["adjustments_ms"]["SAT-04"] == 370
    assert result["timeline_order_corrected"] is True
    assert [event["kind"] for event in result["events_after"]] == ["THERMAL_ANOMALY", "RELAY_RECEIVED"]


def test_nonresponsive_satellite_is_excluded_not_silently_corrected():
    experiment = ClockSyncExperiment()
    result = experiment.run(unavailable=["SAT-03"])
    assert "SAT-03" in result["excluded_satellites"]
    assert "SAT-03" not in result["adjustments_ms"]
    assert result["offsets_after_ms"]["SAT-03"] == 500
    assert result["timeline_order_corrected"] is False


def test_reset_restores_repeatable_baseline():
    experiment = ClockSyncExperiment()
    experiment.run()
    state = experiment.reset()
    assert state["offsets_ms"] == {"SAT-01": 200, "SAT-02": -150, "SAT-03": 500, "SAT-04": -300, "SAT-05": 100}
    assert state["spread_ms"] == 800
    assert state["last_result"] is None
