// Two test projects, because they need two different runtimes.
//
// - vitest.config.ts        — jsdom, for browser and pure-function tests.
// - vitest.workers.config.ts — workerd + a real D1, for anything that asserts on a
//                              stored row. jsdom has no D1, so before this split
//                              "the insert produced these exact columns" was
//                              untestable.
//
// `npm test` runs both, and CI runs `npm test`.
export default ['./vitest.config.ts', './vitest.workers.config.ts'];
