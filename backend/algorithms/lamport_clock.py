"""Lamport logical clock primitives. These counters are independent of wall-clock time."""
from __future__ import annotations


class LamportClock:
    """One process-local Lamport counter."""

    def __init__(self, initial: int = 0) -> None:
        if initial < 0:
            raise ValueError("Initial logical clock cannot be negative.")
        self.value = initial

    def local_event(self) -> tuple[int, int]:
        before = self.value
        self.value += 1
        return before, self.value

    def send_event(self) -> tuple[int, int]:
        # A send is also an event in the sending process.
        return self.local_event()

    def receive_event(self, message_timestamp: int) -> tuple[int, int]:
        if message_timestamp < 0:
            raise ValueError("Message timestamp cannot be negative.")
        before = self.value
        self.value = max(self.value, message_timestamp) + 1
        return before, self.value

    def snapshot(self) -> int:
        return self.value
