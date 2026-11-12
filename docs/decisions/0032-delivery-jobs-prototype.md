# 0032 — Delivery jobs in the prototype

**Status:** accepted — 2026-11-12

## Context

The prototype loop gave the Fugitive only one goal: stay away from the Agents
until the next Appearance. The director asked for criminal delivery work so the
Fugitive has a destination, a risk and a score. The agreed shape:

- jobs appear at random public places, not one fixed Black Market;
- one active job at a time, with other offers allowed for the future
  multi-Fugitive game;
- pickup is public, delivery is private;
- **Collect** and **Deliver** are explicit actions and consume the Fugitive's
  turn;
- a £10 prize per delivery, per-Yard cash only;
- no cargo restrictions or job time limits yet;
- pickup and destination markers shown to the Fugitive, with the destination
  revealed when a job is selected.

## Decision

1. **State.** `PrototypeState` carries `jobs`, `activeJobId`, `cash`,
   `jobsDelivered` and the normalised `jobPickups`. A job is one immutable record
   with a title, shipment icon, pickup, destination, prize, spawn/expiry turns and
   status.
2. **Cadence.** One offer spawns at the start of turns **1, 6, 11, …**; an
   unclaimed offer expires after **5 turns**. An active job never expires. One
   active job per Fugitive; it cannot be abandoned, and other offers are locked
   while carrying.
3. **Places.** Pickup is only at a station near a public landmark; the UI derives
   those stations from `map.city.landmarks` and passes them in setup. Destination
   is any other station.
4. **Actions.** `collect-job` requires the job to be available at the Fugitive's
   current node; `deliver-job` requires the active job's destination. Both are
   Fugitive commands that hand the turn to the Agents without moving. The pickup
   appends the only public job log row; delivery adds no public row.
5. **Money.** A delivery credits **£10** to a per-Yard cash total. Cash is
   displayed in the Fugitive's jobs panel and result only; Agents never see the
   cash or delivery count. It does not persist between Yards and cannot be spent
   yet.
6. **UI.** A Fugitive-only **Smuggling jobs** panel shows the active job and
   offers, with pickup, destination, prize and expiry. Selecting a job shows its
   destination marker. The map shows shipment badges at pickup stations, and a
   destination flag/ring for the selected or active job. Agents see only a pickup
   marker once the public pickup happens.
7. **Bot.** The bot Fugitive collects the earliest expiring offer it can reach
   and heads for the drop, falling back to evasion when no job is reachable.

The numbers are **provisional** (`PROVISIONAL_JOB_INTERVAL_TURNS`,
`PROVISIONAL_JOB_LIFETIME_TURNS`, `PROVISIONAL_JOB_PRIZE_POUNDS`): the director
set the shape and the timing is explicitly to be tested. Tests cover cadence,
expiry, one active job, explicit actions, public pickup/private delivery, payout
and the bot path.

## Rejected alternatives

1. **A single Black Market job source.** Rejected: the director wants jobs at
   random public places, which also explains why a pickup is publicly noticeable.
2. **Multiple active jobs.** Rejected for now: one active job is the decision;
   other offers exist for the future multi-Fugitive game.
3. **Free Collect/Deliver actions.** Rejected: the turn cost is the risk. The
   Fugitive must stand at the public pickup for a turn, and at the drop for a
   turn, while the Agents move.
4. **Public destination or delivery.** Rejected: it lets the Agents camp the
   drop and removes the hidden-movement pressure. Only the pickup is public.
5. **Job time limits.** Rejected for now; offers expire, but an active job does
   not.
6. **Cargo restrictions and persistent cash now.** Deferred: large cargo =
   taxi-only, ticket purchasing, and the Run rule all change the map economy and
   need their own balance pass.
7. **A single job total for the whole Yard.** Rejected: new offers should keep
   appearing every five turns, even while a job is active, so the future
   multi-Fugitive table has work to claim.

## Consequences

- The Fugitive now has a second goal and a reason to cross the map; the pickup
  creates a public, risky moment.
- The £10 prize is period-plausible but, at literal 1925 fares, would buy many
  tickets. The ticket-price calibration is deliberately deferred to the cash
  economy slice.
- The current capture/survival result remains; cash is a separate score. The
  future multi-Fugitive scoring model is out of scope.
- Job titles and icons are seeded from a fixed catalogue; no new art pipeline.
