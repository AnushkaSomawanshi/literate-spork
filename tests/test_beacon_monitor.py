import pytest
from backend.algorithms.beacon_monitor import BeaconMonitor


class Clock:
    def __init__(self):
        self.now = 100.0
    def __call__(self):
        return self.now
    def advance(self, amount):
        self.now += amount


def setup_lab():
    clock = Clock()
    lab = BeaconMonitor(clock)
    lab.reset()
    return lab, clock


def selected(lab, satellite="SAT-02"):
    return next(item for item in lab.tick()["nodes"] if item["satellite_id"] == satellite)


def test_all_five_nodes_begin_active():
    lab, _ = setup_lab()
    assert lab.status()["counts"] == {"ACTIVE": 5, "SUSPECTED": 0, "OFFLINE": 0}


def test_suspicion_boundary():
    lab, clock = setup_lab()
    lab.simulate("SAT-02", "pause")
    clock.advance(6)
    assert selected(lab)["state"] == "SUSPECTED"


def test_offline_boundary():
    lab, clock = setup_lab()
    lab.simulate("SAT-02", "pause")
    clock.advance(12)
    assert selected(lab)["state"] == "OFFLINE"


def test_resume_emits_fresh_sequence_and_recovers():
    lab, clock = setup_lab()
    lab.simulate("SAT-02", "pause")
    clock.advance(13)
    previous = selected(lab)["sequence"]
    lab.simulate("SAT-02", "resume")
    assert selected(lab)["state"] == "ACTIVE"
    assert selected(lab)["sequence"] == previous + 1


def test_other_satellites_keep_beaconing():
    lab, clock = setup_lab()
    previous = selected(lab, "SAT-01")["sequence"]
    lab.simulate("SAT-02", "pause")
    clock.advance(2.1)
    assert selected(lab, "SAT-01")["sequence"] > previous
    assert selected(lab, "SAT-02")["sequence"] == 1


def test_invalid_threshold_order_rejected():
    lab, _ = setup_lab()
    with pytest.raises(ValueError):
        lab.configure(2, 12, 6)


def test_invalid_satellite_rejected():
    lab, _ = setup_lab()
    with pytest.raises(ValueError):
        lab.simulate("SAT-99", "pause")
