import fs from 'node:fs';
import vm from 'node:vm';
const main = fs.readFileSync(new URL('../legacy/index.html', import.meta.url), 'utf8');
const map = fs.readFileSync(new URL('../legacy/map.html', import.meta.url), 'utf8');
function literal(source, name) {
  const start = source.indexOf('=', source.indexOf(`const ${name}=`)) + 1;
  if (!start) throw Error(`Missing ${name}`);
  let depth = 0, quote = '', escaped = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; }
    else if ('\'"`'.includes(c)) quote = c;
    else if ('[{'.includes(c)) depth++;
    else if (']}'.includes(c)) { if (--depth === 0) return vm.runInNewContext(`(${source.slice(start, i + 1)})`, {}, { timeout: 1000 }); }
  }
  throw Error(`Unclosed ${name}`);
}
const result = { baseline: '8f42803202208454669252222adf74d88188bade', questions: literal(main,'QUESTIONS'), rulers: literal(main,'RULERS'), epochs: literal(main,'EPOCHS'), mapEras: literal(map,'eras'), mapNotes: literal(map,'EXTRA'), mapEvents: literal(map,'CHRON_EVENTS') };
fs.writeFileSync(new URL('../data/legacy.json', import.meta.url), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ questions: result.questions.length, rulers: Object.values(result.rulers).flat().length, epochs: result.epochs.length, mapEras: result.mapEras.length, mapEvents: result.mapEvents.flat().length }));
