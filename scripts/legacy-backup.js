// Пользователь запускает этот код в консоли старого сайта, если переносит данные на другой адрес.
// Код только читает исторические ключи и скачивает локальный JSON, ничего не отправляет.
(() => {
  const raw={};
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(/^(history_ege_|chronika_|hronika_map_)/.test(key))raw[key]=localStorage.getItem(key);
  }
  const url=URL.createObjectURL(new Blob([JSON.stringify({format:'chronika-raw-backup',version:1,raw},null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='хроника-полная-копия.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
})();
