export const TYPES = ['choice','multi','text','number','match','sequence','gaps','visual','extended'];
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
function text(value, rules={}) {
  let s=String(value??'').trim();
  if(rules.caseInsensitive) s=s.toLocaleLowerCase('ru');
  if(rules.foldYo) s=s.replace(/ё/g,'е');
  if(rules.collapseSpaces) s=s.replace(/\s+/g,' ');
  return s;
}
export function checkAnswer(q, answer) {
  if(q.type==='extended') return {correct:null,selfAssessed:true};
  if(answer===null) return {correct:false};
  const type=q.type==='visual'?q.responseType:q.type;
  switch(type) {
    case 'choice': return {correct:Number.isInteger(answer)&&answer===q.answer};
    case 'multi': return {correct:Array.isArray(answer)&&new Set(answer).size===answer.length&&same([...answer].sort(),[...q.answer].sort())};
    case 'text': return {correct:q.accepted.some(v=>text(v,q.rules)===text(answer,q.rules))};
    case 'number': {
      const raw=typeof answer==='object'?answer?.value:answer;
      const s=String(raw??'').trim().replace(',','.');
      const valid=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s);
      const unit=typeof answer==='object'?answer?.unit:'';
      return {correct:valid&&Number.isFinite(Number(s))&&Math.abs(Number(s)-q.answer)<=(q.tolerance??0)&&(!q.unit||unit===q.unit)};
    }
    case 'match': case 'sequence': return {correct:Array.isArray(answer)&&same(answer,q.answer)};
    case 'gaps': return {correct:Array.isArray(answer)&&answer.length===q.accepted.length&&q.accepted.every((v,i)=>v.some(x=>text(x,q.rules)===text(answer[i],q.rules)))};
    case 'extended': return {correct:null,selfAssessed:true};
    default: throw Error(`Неизвестный тип ${q.type}`);
  }
}
export function validateQuestion(q) {
  const errors=[];
  for(const k of ['id','version','subjectId','topicIds','type','prompt','explanation','difficulty','source','reviewStatus']) if(q[k]===undefined)errors.push(`${q.id??'?'}: нет ${k}`);
  const t=q.type==='visual'?q.responseType:q.type;
  if(!TYPES.includes(q.type)||!TYPES.includes(t))errors.push(`${q.id}: тип`);
  if(!Array.isArray(q.topicIds)||!q.topicIds.length)errors.push(`${q.id}: темы`);
  if(['choice','multi'].includes(t)&&(!Array.isArray(q.options)||q.options.length<2||new Set(q.options).size!==q.options.length))errors.push(`${q.id}: варианты`);
  if(t==='choice'&&(!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length))errors.push(`${q.id}: индекс ответа`);
  if(t==='multi'&&(!Array.isArray(q.answer)||!q.answer.length||new Set(q.answer).size!==q.answer.length||q.answer.some(i=>!Number.isInteger(i)||i<0||i>=q.options.length)))errors.push(`${q.id}: набор ответа`);
  if(t==='number'&&(!Number.isFinite(q.answer)||(q.tolerance!==undefined&&(!Number.isFinite(q.tolerance)||q.tolerance<0))))errors.push(`${q.id}: число`);
  if(t==='text'&&(!q.accepted?.length||q.accepted.some(x=>typeof x!=='string')))errors.push(`${q.id}: текстовые ответы`);
  if(['match','sequence'].includes(t)&&(!q.answer?.length||q.answer.length!==q.items?.length||q.answer.some(x=>!Number.isInteger(x)||x<0||x>=(t==='match'?q.options.length:q.items.length))||(t==='sequence'&&new Set(q.answer).size!==q.items.length)))errors.push(`${q.id}: порядок/соответствие`);
  if(t==='gaps'&&(!q.accepted?.length||q.parts?.length!==q.accepted.length+1||q.accepted.some(x=>!Array.isArray(x)||!x.length)))errors.push(`${q.id}: пропуски`);
  if(t==='extended'&&!q.rubric?.length)errors.push(`${q.id}: критерии`);
  if(q.type==='visual'&&!q.diagram)errors.push(`${q.id}: материал`);
  return errors;
}
