import fs from 'node:fs';
import {buildCatalog,SUBJECTS} from '../src/catalog.js';
import {validateQuestion,checkAnswer} from '../src/engine.js';
const legacy=JSON.parse(fs.readFileSync(new URL('../data/legacy.json',import.meta.url))),modules=JSON.parse(fs.readFileSync(new URL('../data/modules.json',import.meta.url)));
const catalog=buildCatalog(legacy,modules),errors=catalog.questions.flatMap(validateQuestion);
const topicIds=new Set(catalog.topics.map(t=>t.id)),ids=new Set();
for(const q of catalog.questions){if(ids.has(q.id))errors.push(`Duplicate ${q.id}`);ids.add(q.id);if(!SUBJECTS.some(s=>s.id===q.subjectId))errors.push(`${q.id}: subject`);for(const id of q.topicIds)if(!topicIds.has(id)||!catalog.topics.some(t=>t.id===id&&t.subjectId===q.subjectId))errors.push(`${q.id}: topic reference`);if(q.type!=='extended'){const a=q.accepted?(q.type==='gaps'?q.accepted.map(x=>x[0]):q.accepted[0]):q.unit?{value:String(q.answer),unit:q.unit}:q.answer;if(!checkAnswer(q,a).correct)errors.push(`${q.id}: canonical answer rejected`);}}
for(const t of catalog.topics){if(!t.sections.length||!t.questionIds.length)errors.push(`${t.id}: empty topic`);}
if(new Set(catalog.topics.map(t=>t.id)).size!==catalog.topics.length)errors.push('Duplicate topic');
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`OK: ${SUBJECTS.length} subjects, ${catalog.topics.length} topics, ${catalog.questions.length} tasks; canonical answers and references valid.`);
