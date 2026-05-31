// Clumeral — walkthrough.ts
// First-play octopus walkthrough: the mascot "talks" through the /play header,
// typing a scripted tutorial in place of the "Clumeral" wordmark.
// Frontend-only. No worker/API changes. Triggered on a player's first game
// (suppressed once `dlng_history` exists). See
// docs/superpowers/specs/2026-05-31-octopus-walkthrough-design.md.

export type StepKind = 'timed' | 'gated' | 'end';
export type GateEvent = 'game:box-opened' | 'game:digit-eliminated';

export interface Step {
  kind: StepKind;
  text: string;
  gate?: GateEvent;
}

export const STEPS: Step[] = [
  { kind: 'timed', text: "Looks like it's your first time here…" },
  { kind: 'timed', text: 'The goal: work out the 3-digit number.' },
  { kind: 'gated', text: 'Tap one of those big digit boxes to open it…', gate: 'game:box-opened' },
  { kind: 'gated', text: "Now disable digits it can't be, using the clues.", gate: 'game:digit-eliminated' },
  { kind: 'end', text: '' },
];

export const TYPE_MS = 45;
export const DELETE_MS = 25;

// True iff `event` is the gate this step is waiting on.
export function gateMatches(step: Step, event: GateEvent): boolean {
  return step.kind === 'gated' && step.gate === event;
}

// Reading-time hold: 200 wpm + 1s buffer, 2s floor.
export function holdMsFor(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const ms = Math.round((words / 200) * 60_000) + 1000;
  return Math.max(ms, 2000);
}
