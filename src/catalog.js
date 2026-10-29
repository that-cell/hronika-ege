export const SETTINGS={platformName:'Траектория',tagline:'Подготовка в твоём ритме'};
export const SUBJECTS=[
 {id:'history',title:'История',short:'Хроника',icon:'⌛',color:'#ad7144',soft:'#faf0e6',description:'События складываются в историю',sections:['Древняя Русь','Раздробленность и Орда','Собирание земель','Русское царство','Российская империя','Империя и реформы','Советская эпоха','Современная Россия']},
 {id:'social',title:'Обществознание',icon:'◎',color:'#7661b1',soft:'#f1edfb',description:'Понимать общество и его законы',sections:['Человек и общество','Духовная культура','Экономика','Социальные отношения','Политика','Право']},
 {id:'math-profile',title:'Математика',suffix:'Профильная',icon:'ƒ',color:'#4e73b8',soft:'#ecf2ff',description:'От формул к уверенному решению',sections:['Уравнения','Алгебра','Функции','Планиметрия','Стереометрия','Вероятность','Развёрнутые решения']},
 {id:'math-base',title:'Математика',suffix:'Базовая',icon:'%',color:'#4c927e',soft:'#eaf6ef',description:'Математика, которая рядом',sections:['Вычисления','Проценты','Практические задачи','Уравнения','Геометрия','Таблицы и графики']},
 {id:'russian',title:'Русский язык',icon:'Аа',color:'#b76c7c',soft:'#fbeef2',description:'Почувствовать логику языка',sections:['Орфография','Пунктуация','Ударения','Грамматические нормы','Текст','Письменная практика']},
 {id:'informatics',title:'Информатика',icon:'⌘',color:'#5f81a3',soft:'#edf3f8',description:'Мыслить ясно, шаг за шагом',sections:['Алгоритмы','Логика','Кодирование','Системы счисления','Таблицы','Программирование']},
 {id:'physics',title:'Физика',icon:'↗',color:'#bc9143',soft:'#fbf5e7',description:'Увидеть закономерности мира',sections:['Механика','Молекулярная физика','Электродинамика','Колебания и волны','Оптика','Квантовая физика']}
];
const bounds=[862,1054,1340,1533,1682,1825,1917,1991];
function epochForYear(year){let i=bounds.findLastIndex(y=>year>=y);return i<0?0:i;}
const yearIn=s=>Number(String(s).match(/\b(?:[89]\d{2}|1\d{3}|20\d{2})\b/)?.[0])||null;
export function buildCatalog(legacy,modules){
  const topics=legacy.epochs.map((e,i)=>({id:`history-${e.id}`,subjectId:'history',title:e.title,subtitle:e.desc,periodLabel:i<7?`${bounds[i]}–${bounds[i+1]}`:'с 1991 года',minutes:10,sections:[]}));
  const rulers=Object.values(legacy.rulers).flat();
  for(const r of rulers){const y=yearIn(r[1]);topics[epochForYear(y??862)].sections.push([r[0]+' · '+r[1],Array.isArray(r[2])?r[2].join(' '):String(r[2])]);}
  const source={title:'Исходный репозиторий «Хроника»',url:'https://github.com/that-cell/hronika-ege',kind:'legacy',asOf:'2026-10-29'};
  const questions=legacy.questions.map(q=>{
    const year=yearIn(q.explanation)??yearIn(q.context)??(q.period==='early'?862:1340);
    return {id:q.id,version:1,subjectId:'history',topicIds:[topics[epochForYear(year)].id],type:'choice',prompt:q.question,context:q.context,options:q.options,answer:q.correct,explanation:q.explanation,difficulty:q.level,source,reviewStatus:'legacy-unreviewed'};
  });
  legacy.mapEvents.forEach((rows,era)=>rows.forEach(([year,event],i)=>{
    const topic=topics[epochForYear(yearIn(year)??862)];
    if(!topic.sections.some(x=>x[0]==='Хронология'))topic.sections.push(['Хронология','']);
    topic.sections.find(x=>x[0]==='Хронология')[1]+=`${year} — ${event}.\n`;
    const years=[...new Set(rows.map(x=>x[0]))];const opts=[year,...years.filter(y=>y!==year).slice(0,3)];
    const base={version:1,subjectId:'history',topicIds:[topic.id],difficulty:'Хронология',source,reviewStatus:'legacy-unreviewed'};
    questions.push({...base,id:`map-${era}-${i}-date`,type:'choice',prompt:`Когда произошло событие: «${event}»?`,options:opts,answer:0,explanation:`${event} — ${year}.`});
    // Exclude all other events of the same year, so a single-answer question stays unambiguous.
    const wrong=rows.filter(x=>x[0]!==year&&x[1]!==event).map(x=>x[1]).filter((x,i,a)=>a.indexOf(x)===i).slice(0,3);
    questions.push({...base,id:`map-${era}-${i}-event`,type:'choice',prompt:`Какое событие относится к дате «${year}»?`,options:[event,...wrong],answer:0,explanation:`${year} — ${event}.`});
  }));
  modules.forEach(m=>{topics.push({...m,questions:undefined});questions.push(...m.questions);});
  for(const t of topics)t.questionIds=questions.filter(q=>q.topicIds.includes(t.id)).map(q=>q.id);
  return {subjects:SUBJECTS,topics,questions,legacy};
}
