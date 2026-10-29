import {checkAnswer} from './engine.js';
export const INTERVALS=[1,3,7,14,30];
export function dayKey(at=new Date(),timezone='Asia/Yekaterinburg') {
  const parts=new Intl.DateTimeFormat('en',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at));
  const get=k=>parts.find(p=>p.type===k).value;return `${get('year')}-${get('month')}-${get('day')}`;
}
export function addDays(day,n) {const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function recordAttempt(profile,q,answer,{now=new Date(),elapsedMs=0,mode='learn',confidence='unsure'}={}) {
  const at=new Date(now).toISOString(),localDate=dayKey(at,profile.settings.timezone);
  const result=checkAnswer(q,answer);
  const attempt={id:globalThis.crypto.randomUUID(),questionId:q.id,questionVersion:q.version,subjectId:q.subjectId,topicIds:[...q.topicIds],at,localDate,answer,correct:result.correct,elapsedMs:Math.max(0,Math.round(elapsedMs)),mode,confidence,selfAssessed:!!result.selfAssessed};
  profile.attempts.push(attempt);
  if(result.selfAssessed)return attempt;
  const previous=profile.reviews[q.id];
  const confident=result.correct&&confidence==='sure';
  const spaced=confident&&(!previous?.lastSuccessDay||localDate>previous.lastSuccessDay);
  // Same-day correction cannot clear an error or move the interval.
  const successes=confident?(previous?.spacedSuccesses??0)+(spaced?1:0):0;
  const stage=confident?(previous?.spacedSuccesses>0?(spaced?Math.min(previous.stage+1,4):previous.stage):0):0;
  profile.reviews[q.id]={questionId:q.id,stage,due:confident&&!spaced&&previous?previous.due:addDays(localDate,INTERVALS[stage]),lastSuccessDay:confident?localDate:previous?.lastSuccessDay??null,spacedSuccesses:successes,unresolvedError:!confident||!!previous?.unresolvedError&&successes<2};
  return attempt;
}
export function dueReviews(profile,today=dayKey(new Date(),profile.settings.timezone)) {return Object.values(profile.reviews).filter(r=>r.due<=today).sort((a,b)=>a.due.localeCompare(b.due));}
export function topicState(profile,topic,today=dayKey(new Date(),profile.settings.timezone)) {
  const attempts=profile.attempts.filter(a=>a.topicIds.includes(topic.id)&&!a.selfAssessed);
  const ids=new Set(attempts.map(a=>a.questionId));
  const old=profile.legacy?.history_ege_200_v1;
  if(topic.subjectId==='history'&&topic.questionIds?.some(id=>old?.wrong?.[id]&&!profile.reviews[id]))return {label:'Требует повторения',key:'review',reason:'В старом тренажёре были ошибки'};
  const legacyStudied=topic.subjectId==='history'&&topic.questionIds?.some(id=>old?.answers?.[id]!==undefined);
  if(!attempts.length&&!profile.lessons[topic.id]&&!legacyStudied)return {label:'Не начата',key:'new',reason:'Ещё нет учебных действий'};
  const reviews=Object.values(profile.reviews).filter(r=>ids.has(r.questionId));
  if(reviews.some(r=>r.unresolvedError||r.due<=today))return {label:'Требует повторения',key:'review',reason:'Есть ошибки, сомнения или подошёл срок повторения'};
  const days=new Set(attempts.filter(a=>a.correct&&a.confidence==='sure').map(a=>a.localDate));
  if(ids.size>=3&&days.size>=2&&attempts.filter(a=>a.correct).length/attempts.length>=.8)return {label:'Закреплена',key:'mastered',reason:'Достаточно разных заданий и успешных учебных дней'};
  return {label:'Изучается',key:'learning',reason:`Нужно 3 разных задания и 2 дня уверенных решений. Сейчас: ${ids.size} заданий, ${days.size} дней`};
}
export function subjectStats(profile,subjectId,questions) {
  const attempts=profile.attempts.filter(a=>a.subjectId===subjectId&&!a.selfAssessed);
  const legacyIds=subjectId==='history'?Object.keys(profile.legacy?.history_ege_200_v1?.answers??{}).filter(id=>questions.some(q=>q.id===id)):[];
  const answered=new Set([...attempts.map(a=>a.questionId),...legacyIds]).size;
  return {answered,total:questions.filter(q=>q.subjectId===subjectId).length,attempts:attempts.length,correct:attempts.filter(a=>a.correct).length,accuracy:attempts.length?Math.round(100*attempts.filter(a=>a.correct).length/attempts.length):null};
}
export function activity(profile) {const days={};for(const a of profile.attempts)days[a.localDate]=(days[a.localDate]??0)+1;for(const d of Object.values(profile.lessons))if(d?.day)days[d.day]=(days[d.day]??0)+1;return days;}
export function streak(profile,today=dayKey(new Date(),profile.settings.timezone)) {const days=activity(profile);let d=days[today]?today:addDays(today,-1),n=0;while(days[d]){n++;d=addDays(d,-1);}return n;}
export function makePlan(profile,topics,questions,today=dayKey(new Date(),profile.settings.timezone)) {
  const selected=new Set(profile.settings.selectedSubjects),plan=[];let budget=profile.settings.minutes;
  const due=dueReviews(profile,today).filter(r=>questions.some(q=>q.id===r.questionId&&selected.has(q.subjectId)));
  if(due.length&&budget>=5){const count=Math.min(due.length,Math.floor(budget/2),10);plan.push({kind:'review',title:'Повторить изученное',reason:'Подошёл срок интервального повторения',minutes:Math.min(10,count*2),questionIds:due.slice(0,count).map(r=>r.questionId)});budget-=plan[0].minutes;}
  const weak=topics.filter(t=>selected.has(t.subjectId)&&topicState(profile,t,today).key==='review');
  const unstudied=topics.filter(t=>selected.has(t.subjectId)&&!weak.includes(t)&&!profile.lessons[t.id]);
  const candidates=[...weak];
  // Give each chosen subject a turn before filling remaining time with more topics.
  for(const id of selected){const next=unstudied.find(t=>t.subjectId===id);if(next)candidates.push(next);}
  candidates.push(...unstudied.filter(t=>!candidates.includes(t)));
  for(const t of candidates){if(budget<5)break;if(plan.length>=4)break;const minutes=Math.min(10,budget);plan.push({kind:'lesson',topicId:t.id,subjectId:t.subjectId,title:t.title,reason:weak.includes(t)?'В прошлых тренировках были ошибки или сомнения в этой теме':'Короткий материал и практика по выбранному предмету',minutes});budget-=minutes;}
  if(!plan.length&&budget>=5){const t=topics.find(t=>selected.has(t.subjectId));if(t)plan.push({kind:'lesson',topicId:t.id,subjectId:t.subjectId,title:t.title,reason:'Продолжи практику: закрепление требует решений в разные дни',minutes:Math.min(10,budget)});}
  return plan;
}
