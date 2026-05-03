import { describe, it } from 'vitest';

describe('router (RTE-01, POL-01..04)', () => {
  it.todo('RTE-01: navigate(/play) updates location.pathname to /play');
  it.todo('RTE-01: navigate(/play) calls showScreen("game")');
  it.todo('RTE-01: popstate re-renders the route from location.pathname');
  it.todo('RTE-03: replaceRoute(/solved) on solve uses history.replaceState not pushState');
  it.todo('POL-01: navigate(/play) sets document.title to "Clumeral · Play"');
  it.todo('POL-01: navigate(/welcome) sets document.title to "Clumeral"');
  it.todo('POL-01: navigate(/solved) sets document.title to "Clumeral · Solved"');
  it.todo('POL-01: navigate(/archive) sets document.title to "Clumeral · Archive"');
  it.todo('POL-02: navigate emits one route_change analytics event with the new path');
  it.todo('POL-03: initRouter sets history.scrollRestoration to "manual"');
  it.todo('POL-04: stale-day check skips redirect while activeBox !== null or submitting');
  it.todo('POL-04: stale-day check is registered on visibilitychange + focus, not setInterval');
});
