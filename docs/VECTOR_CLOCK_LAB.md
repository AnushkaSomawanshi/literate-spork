# Vector Clock Lab

The Vector Clock Lab demonstrates causal ordering across five simulated satellite processes: SAT-01 through SAT-05. It is an educational simulation and does not alter operating-system clocks or live telemetry.

## Correct rules

- Each process owns one component in the vector.
- A local event increments only the owner's component.
- A send is an event: increment the sender's component and attach an immutable copy of the resulting vector to the message.
- A receive merges the local and received vectors component-wise using maximum, then increments the receiver's own component.
- A is strictly before B iff every component of A is less than or equal to B and at least one is strictly smaller. If neither vector dominates the other, events are concurrent. Equal vectors are reported separately; equality is not strict happened-before.

Component order is [SAT-01, SAT-02, SAT-03, SAT-04, SAT-05].

## API

- GET /api/algorithms/vector/state
- POST /api/algorithms/vector/event with operation local, send, or receive
- POST /api/algorithms/vector/compare with two event IDs or two vectors
- POST /api/algorithms/vector/scenario/worked-example
- POST /api/algorithms/vector/scenario/concurrency
- POST /api/algorithms/vector/reset

## Reproducible examples

The worked example creates two local SAT-03 events, sends a message from SAT-01, then receives it at SAT-03. The message carries [1,0,0,0,0]; SAT-03's local vector before receipt is [0,0,2,0,0]; the merged vector is [1,0,2,0,0]; after SAT-03 increments its own component the result is [1,0,3,0,0].

The concurrency scenario creates independent events on SAT-01 and SAT-02. Their vectors [1,0,0,0,0] and [0,1,0,0,0] are concurrent because neither dominates the other.
