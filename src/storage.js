export const KEY='trajectory_store_v1',BACKUP_KEY='trajectory_legacy_backup_v1';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const safeId=v=>typeof v==='string'&&v.length>0&&v.length<120&&!['__proto__','prototype','constructor'].includes(v);
export function newProfile(name='Ученик',id=crypto.randomUUID()) {return {id,name,settings:{selectedSubjects:['history','social','math-profile'],minutes:30,goals:{},examDates:{},timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Yekaterinburg'},attempts:[],reviews:{},lessons:{},session:null,legacy:{}};}
const relevant=k=>/^(history_ege_|chronika_|hronika_map_)/.test(k);
export function migrate(storage) {
  const existing=storage.getItem(KEY);
  if(existing){const parsed=JSON.parse(existing);validateStore(parsed);return parsed;}
  const raw={};for(let i=0;i<storage.length;i++){const k=storage.key(i);if(relevant(k))raw[k]=storage.getItem(k);}
  // Must persist the untouched snapshot before the first new-format write.
  if(!storage.getItem(BACKUP_KEY))storage.setItem(BACKUP_KEY,JSON.stringify({format:'chronika-raw-backup',version:1,raw}));
  const parse=k=>{try{return JSON.parse(raw[k]??'null');}catch{return null;}};
  const profiles=[];
  const oldProfiles=parse('chronika_profiles_v1');
  if(Array.isArray(oldProfiles))for(const p of oldProfiles){if(!safeId(p.id)||typeof p.name!=='string'||profiles.some(x=>x.id===p.id))continue;const n=newProfile(p.name.slice(0,30),p.id);for(const base of ['history_ege_200_v1','chronika_daily_v1','hronika_map_v4_mastery']){const k=base+'__'+p.id;if(raw[k]!==undefined)n.legacy[base]=parse(k);}profiles.push(n);}
  const unowned={};for(const [k,v]of Object.entries(raw)){if(!k.includes('__')&&!['chronika_profiles_v1','chronika_active_profile_v1','chronika_profile_legacy_claimed'].includes(k)||k.endsWith('__default'))unowned[k]=v;}
  if(Object.keys(unowned).length){const p=newProfile('Старые данные · без владельца','legacy-unassigned');p.legacy={unassignedRaw:unowned};for(const base of ['history_ege_200_v1','chronika_daily_v1','hronika_map_v4_mastery'])if(raw[base]!==undefined)p.legacy[base]=parse(base);profiles.push(p);}
  const defaultRaw=Object.fromEntries(Object.entries(raw).filter(([k])=>k.endsWith('__default')));
  if(Object.keys(defaultRaw).length){const p=newProfile('Старый неименованный профиль','legacy-default');p.legacy={unassignedRaw:defaultRaw};for(const base of ['history_ege_200_v1','chronika_daily_v1','hronika_map_v4_mastery'])if(raw[base+'__default']!==undefined)p.legacy[base]=parse(base+'__default');profiles.push(p);}
  // Preserve orphaned profile keys as raw data without assigning them to another learner.
  const orphaned={};for(const [k,v]of Object.entries(raw))if(k.includes('__')&&!k.endsWith('__default')&&!profiles.some(p=>k.endsWith('__'+p.id)))orphaned[k]=v;
  if(Object.keys(orphaned).length){const p=newProfile('Архив неизвестных профилей','legacy-orphans');p.legacy={unassignedRaw:orphaned};profiles.push(p);}
  if(!profiles.length)profiles.push(newProfile());
  const active=raw.chronika_active_profile_v1;
  const store={schemaVersion:1,activeProfileId:profiles.find(p=>p.id===active)?.id??profiles[0].id,profiles,migration:{version:1,at:new Date().toISOString(),keys:Object.keys(raw)}};
  validateStore(store);storage.setItem(KEY,JSON.stringify(store));return store;
}
export function validateProfile(p) {
  if(!object(p)||!safeId(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>60||!object(p.settings)||!Array.isArray(p.attempts)||!object(p.reviews)||!object(p.lessons)||!object(p.legacy))throw Error('Повреждён профиль');
  const s=p.settings;if(!Array.isArray(s.selectedSubjects)||!s.selectedSubjects.length||s.selectedSubjects.some(x=>!['history','social','math-profile','math-base','russian','informatics','physics'].includes(x))||!Number.isFinite(s.minutes)||s.minutes<5||s.minutes>180||!object(s.goals)||!object(s.examDates))throw Error('Повреждены настройки');
  try{new Intl.DateTimeFormat('ru',{timeZone:s.timezone}).format();}catch{throw Error('Неизвестный часовой пояс');}
  const ids=new Set();
  for(const a of p.attempts){if(!object(a)||!safeId(a.id)||ids.has(a.id)||typeof a.questionId!=='string'||!Number.isInteger(a.questionVersion)||!Array.isArray(a.topicIds)||!a.topicIds.every(x=>typeof x==='string')||typeof a.subjectId!=='string'||!['learn','control','review'].includes(a.mode)||!['guess','unsure','sure'].includes(a.confidence)||!Number.isFinite(a.elapsedMs)||a.elapsedMs<0||!Number.isFinite(Date.parse(a.at))||!/^\d{4}-\d{2}-\d{2}$/.test(a.localDate)||![true,false,null].includes(a.correct)||!Object.hasOwn(a,'answer'))throw Error('Повреждена история попыток');ids.add(a.id);}
  for(const [id,r]of Object.entries(p.reviews))if(!object(r)||id!==r.questionId||!safeId(id)||!Number.isInteger(r.stage)||r.stage<0||r.stage>4||!Number.isInteger(r.spacedSuccesses)||r.spacedSuccesses<0||typeof r.unresolvedError!=='boolean'||!/^\d{4}-\d{2}-\d{2}$/.test(r.due)||(r.lastSuccessDay!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(r.lastSuccessDay)))throw Error('Повреждена очередь повторения');
  for(const [id,l]of Object.entries(p.lessons))if(!safeId(id)||!object(l)||!/^\d{4}-\d{2}-\d{2}$/.test(l.day)||!Number.isFinite(Date.parse(l.at)))throw Error('Повреждены уроки');
  if(p.session!==null){const x=p.session;if(!object(x)||!Array.isArray(x.ids)||!x.ids.length||!x.ids.every(safeId)||!Number.isInteger(x.index)||x.index<0||x.index>x.ids.length||!Array.isArray(x.responses)||!['learn','control','review'].includes(x.mode)||!Number.isFinite(Date.parse(x.startedAt)))throw Error('Повреждена незавершённая сессия');
    if(x.responses.length<x.index||x.responses.length>Math.min(x.index+1,x.ids.length)||x.responses.some((r,i)=>!object(r)||!p.attempts.some(a=>a.id===r.attemptId&&a.questionId===x.ids[i])))throw Error('Повреждены ответы сессии');
    if(x.optionOrders!==undefined&&(!object(x.optionOrders)||Object.values(x.optionOrders).some(v=>!Array.isArray(v)||v.some(i=>!Number.isInteger(i)||i<0)||new Set(v).size!==v.length)))throw Error('Повреждён порядок вариантов');
  }
  return p;
}
export function validateStore(s){if(!object(s)||s.schemaVersion!==1||!Array.isArray(s.profiles)||!s.profiles.length||new Set(s.profiles.map(p=>p.id)).size!==s.profiles.length)throw Error('Неподдерживаемая версия хранилища');s.profiles.forEach(validateProfile);if(!s.profiles.some(p=>p.id===s.activeProfileId))throw Error('Нет активного профиля');return s;}
export function saveStore(storage,store){validateStore(store);storage.setItem(KEY,JSON.stringify(store));}
export function exportProfile(profile){validateProfile(profile);return {format:'trajectory-profile',version:1,exportedAt:new Date().toISOString(),profile:structuredClone(profile)};}
export function parseImport(value,current) {
  // Reject dangerous keys before using imported objects anywhere in the UI.
  const data=typeof value==='string'?JSON.parse(value,(k,v)=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('Недопустимый ключ');return v;}):value;
  if(data?.format==='trajectory-profile'&&data.version===1)return {kind:'profile',profile:validateProfile(data.profile)};
  if(data?.format==='trajectory-backup'&&data.version===1){validateStore(data.store);if(data.legacySnapshot)data.store.migration={...data.store.migration,importedSnapshot:data.legacySnapshot};return {kind:'store',store:data.store};}
  if(data?.format==='history-ege-200'&&data.version===1&&object(data.state?.answers)&&object(data.state?.index)){
    if(Object.values(data.state.answers).some(x=>!Number.isInteger(x)||x<0||x>3))throw Error('Повреждены старые ответы');
    const p=structuredClone(current);p.legacy.history_ege_200_v1=data.state;return {kind:'legacy',profile:p};
  }
  if(data?.format==='chronika-raw-backup'&&data.version===1&&object(data.raw)&&Object.entries(data.raw).every(([k,v])=>relevant(k)&&typeof v==='string')){
    const m=new Map(Object.entries(data.raw));const storage={get length(){return m.size;},key:i=>[...m.keys()][i],getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};return {kind:'store',store:migrate(storage)};
  }
  throw Error('Неподдерживаемый или повреждённый файл');
}
