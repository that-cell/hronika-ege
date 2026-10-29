import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url);
await fs.mkdir(new URL('dist/',root),{recursive:true});
for(const file of ['index.html','map.html'])await fs.copyFile(new URL(file,root),new URL('dist/'+file,root));
for(const dir of ['src','data','assets'])await fs.cp(new URL(dir,root),new URL('dist/'+dir,root),{recursive:true});
await fs.writeFile(new URL('dist/release.json',root),JSON.stringify({commit:process.env.COMMIT_REF??null,branch:process.env.BRANCH??null,builtAt:new Date().toISOString()},null,2));
console.log('Static site ready in dist/');
