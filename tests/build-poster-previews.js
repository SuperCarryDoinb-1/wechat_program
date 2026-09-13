const fs = require('node:fs');
const path = require('node:path');
const { drawPoster, drawPairPoster, drawCover } = require('../utils/poster-renderer');
const { buildPair } = require('../utils/pair-result');
const pairConfig = require('../config/pairing');
const { recordingContext } = require('./poster-recording');
const { calc } = require('../utils/scoring');
const fixtures = require('./m1-fixtures.json');
const root = path.resolve(__dirname, '..');
const drawings = [];
for (const code of Object.keys(fixtures.types)) {
  const ctx = recordingContext(); drawPoster(ctx, calc(fixtures.types[code]));
  drawings.push({ file: `docs/poster-check/${code}.png`, width: 750, height: 1334, operations: ctx.operations });
}
for (const code of [...Object.keys(fixtures.types), 'invite']) {
  const ctx = recordingContext(); drawCover(ctx, code);
  drawings.push({ file: `assets/share/${code}.png`, width: 500, height: 400, operations: ctx.operations });
}
fs.mkdirSync(path.join(root, 'docs/poster-check'), { recursive: true });
const pairExamples = pairConfig.levels.map((level, index) => {
  for (const a of Object.keys(fixtures.types)) for (const b of Object.keys(fixtures.types)) {
    if (buildPair(calc(fixtures.types[a]), calc(fixtures.types[b])).name === level.name) return { id: `level-${index}`, codes: [a, b] };
  }
}).concat(pairConfig.specials.map((value, index) => ({ id: `special-${index}`, codes: value.codes })));
for (const example of pairExamples) {
  const ctx = recordingContext(), own = calc(fixtures.types[example.codes[0]]);
  drawPairPoster(ctx, own, buildPair(own, calc(fixtures.types[example.codes[1]])));
  drawings.push({ file: `docs/pair-poster-check/${example.id}.png`, width: 750, height: 1334, operations: ctx.operations });
}
fs.writeFileSync(path.join(root, 'docs/poster-check/drawings.json'), JSON.stringify(drawings, null, 2));
console.log(`${drawings.length} drawings recorded within project. Render with tests/render-poster-previews.ps1.`);
