// David Lark's Lame Number Game — app.js
// Phase 1: CSV data loader
// Phase 2 will add: runFilterLoop()
// Phase 3 will add: UI event handlers

// Module-scoped data store — Phase 2 reads these directly (same file)
let gameRows = [];    // array of row objects; keys are trimmed header strings; numeric values are JS numbers
let gameHeaders = []; // trimmed header strings in CSV column order (23 total)

async function loadData() {
  document.getElementById('status').textContent = 'Loading...';

  let text;
  try {
    const response = await fetch('data.csv');
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    text = await response.text();
  } catch (err) {
    document.getElementById('status').textContent =
      'Error: could not load data.csv';
    console.error('Fetch failed:', err);
    return;
  }

  const results = Papa.parse(text, {
    header: true,
    dynamicTyping: true,
    transformHeader: h => h.trim(),
    skipEmptyLines: true,
  });

  if (results.errors.length > 0) {
    console.warn('PapaParse encountered warnings:', results.errors);
  }

  gameRows = results.data;
  gameHeaders = results.meta.fields; // already trimmed by transformHeader

  console.log(
    `data.csv loaded: ${gameRows.length} rows, ${gameHeaders.length} headers`,
    gameHeaders
  );
  // #status intentionally left as 'Loading...' per Phase 1 scope decision
  // Phase 2/3 will update #status when the game is ready
}

document.addEventListener('DOMContentLoaded', loadData);
