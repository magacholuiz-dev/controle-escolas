# Loop Engineering: PLAN → REFINEMENT → IMPLEMENT → TEST → VERIFY → DOCUMENT → PLAN AGAIN

Process adapted from the Loop Engineering v2 used at Kivoni (`lmfit-web/docs/ecommerce/LOOP_PROCESS.md`).
A loop is a deliverable increment, driven by **one spec** in [`specs/`](./specs/) that carries the
**Follow-up record** through the seven phases. The spec is the source of truth: if the code and the
spec disagree, fix one of them before closing the loop.

```
            ┌──────────────────────────── PLAN AGAIN ◄─────────────────────────┐
            ▼                                                                  │
   PLAN ──► REFINEMENT ──► IMPLEMENT ──► TEST ──► VERIFY ──► DOCUMENT ─────────┘
```

Each phase has an **entry criterion**, a **checklist** (copied into the spec and checked off with
evidence) and an **exit gate**. A TEST/VERIFY failure goes back to IMPLEMENT; a broken assumption
goes back to PLAN.

## Ground rules

- **One loop at a time.** Finish it (or park it with carry-overs recorded) before starting the next.
- **Specs are executable contracts:** every acceptance criterion (AC) names how it's verified — a
  command, a test or a browser step someone else could repeat.
- **Never skip TEST or VERIFY.** TEST = proof by code. VERIFY = proof in the app actually running.
  "Tests pass" alone never closes a loop.
- **Money and personal data:** salaries, CPF, severances and children's data are sensitive (LGPD,
  Brazil's privacy law). Every new endpoint assumes hostile input and returns 400 (never 500) for
  invalid data; no real data in tests or commits.
- **The server is the authority on calculations.** The front end only displays; business rules live
  in pure, testable functions (`calc.js`, `severance.js`, `proration.js` and the new ones).
- **Pure functions first:** new financial logic is born without a database, with a `node:test`/`assert`
  test, before it's wired into Mongo and the screen.
- **Exposure gate:** no loop may publish the app outside the local machine before Loop 8 (users and
  permissions) is Done.

## Project commands

| To | Command |
|---|---|
| Start Mongo | `npm run db` (Docker must be running) |
| App with demo data | `npm run demo` → http://localhost:3200 |
| Logic tests (no database) | `npm test` |
| API tests (with a test Mongo) | `npm run test:api` (created in Loop 0) |
| Backup | `npm run backup` (created in Loop 0) |

## Spec lifecycle

`Draft → Ready → In progress → Testing → Verifying → Done`

## Phase 1 — PLAN (draft the spec)
**Entry:** the previous loop is Done (or parked) and there's an outline in the ROADMAP.
- [ ] Read the previous loop's carry-overs and the relevant sections of `BENCHMARK.md`
- [ ] **Explore the real code** the loop touches and list files/endpoints in the spec (never plan
      from memory)
- [ ] Write the Goal, Scope (in/out), a first draft of the ACs and tasks
- [ ] List open decisions with options (still unresolved)
- [ ] List risks and unknowns to tackle in REFINEMENT

**Exit:** spec `Draft`, linked in the ROADMAP table.

## Phase 2 — REFINEMENT (challenge the spec)
Where scope gets cut, ACs become testable and decisions get resolved, before writing any code.
- [ ] Resolve every decision and record it in the Decisions table with the reasoning (ask the owner
      **now**, never mid-implementation)
- [ ] Check every assumption against the code (grep/read/curl)
- [ ] Rewrite every AC until it names its verification *(verify: …)*
- [ ] Cut or defer anything that doesn't serve the loop's goal (goes into Out of scope)
- [ ] Order the tasks by dependency; split any that's bigger than half a day
- [ ] Definition-of-Ready review: scope fits, ACs are testable, decisions are resolved, tasks are
      ordered

**Exit:** spec `Ready`. No code before this gate.

## Phase 3 — IMPLEMENT (build small)
**Entry:** spec `Ready`. Status becomes `In progress`.
- [ ] Work through the task list top to bottom, checking them off in the spec
- [ ] Follow the existing patterns before inventing new ones (the generic CRUD in `server.js`,
      models in `db.js`, `field()`/`crud()`/`card()` in `public/app.js`)
- [ ] `node --check` on every touched file and `npm test` green after every task, not just at the end
- [ ] New environment variables go into `.env.example` and the Configuration section, in the same
      commit
- [ ] Any blocker or newly-found scope goes back into the spec, never improvised

**Exit:** every task checked off; syntax check and tests green.

## Phase 4 — TEST (prove it by code)
- [ ] A unit test for every new piece of logic with branching
- [ ] Every testable AC has at least one test naming it (`AC4: rejects a negative amount`)
- [ ] Negative paths: invalid input, a nonexistent id, repetition/idempotency, boundary values
      (cents, year rollover, a 28-day month)
- [ ] Full suites green; **record the counts** in the spec
- [ ] No test deleted or weakened just to make it pass

**Exit:** suites green covering the ACs; counts recorded in the spec.

## Phase 5 — VERIFY (prove it live)
Tests don't see UX dead ends. This is where you actually walk through the running app.
- [ ] Walk the whole flow in the browser at `localhost:3200` (click it, don't just `curl` it), with
      screenshots of the key states, in light and dark theme and at phone width
- [ ] Mark every AC as `✅ verified <how>` or `❌ failed`
- [ ] Hostile-input probe on every new endpoint (invalid id, empty body, text where a number was
      expected) and, after Loop 8, an access probe (no login, wrong role)
- [ ] **List everything listening on the network** (`lsof -iTCP -sTCP:LISTEN -n -P`) and check every
      open port of the project: app, database, any new service
- [ ] Regression sweep of the neighboring flows (Dashboard, severance, splitting a purchase,
      calendar)
- [ ] **Check the numbers by hand** at least once: the value on screen matches a calculation done
      outside the app
- [ ] Any ❌ goes back to IMPLEMENT; re-run TEST before coming back here

**Exit:** every AC ✅ with evidence in the Verification record.

## Phase 6 — DOCUMENT (make it durable)
- [ ] Spec: status `Done` and the Result section filled in (what shipped, deviations, evidence)
- [ ] ROADMAP: flip the status and add a Changelog line
- [ ] Update the living docs: `README.md`, `BENCHMARK.md` (the "In this app" column), `.env.example`
- [ ] Clean up: test data, TODOs turned into carry-overs

**Exit:** someone new could pick up the next loop from the docs alone.

## Phase 7 — PLAN AGAIN (retro → next loop)
- [ ] A 3-line retro in the Result: what helped, what hurt, what to change in the process
- [ ] Carry-overs become input for the next PLAN or new ROADMAP lines
- [ ] Re-prioritize: does the next loop still make sense? If not, reorder with a note in the
      Changelog
- [ ] Update the project's memory (roadmap status, next loop, new facts)
- [ ] Start the next loop's PLAN

## Spec template

Copy it to `specs/loop-NN-<slug>.md`. The current files already follow this format.

Sections: Status/Depends on/Files · Goal · Scope (in/out) · Decisions · Acceptance criteria ·
Design notes · Configuration · Tasks · Follow-up record (7 phases) · Verification record · Result.

## Process changelog

| Date | Change |
|---|---|
| 2026-09-21 | VERIFY gains "list everything listening on the network" (Loop 0: Mongo was open to the network and only the full sweep caught it) |
| 2026-09-21 | Adapted Kivoni's Loop Engineering v2 for this project: Node/Mongo commands, the exposure gate, the pure-functions-first rule, and checking the numbers by hand |
