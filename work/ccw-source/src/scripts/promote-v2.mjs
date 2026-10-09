import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
const baseline=JSON.parse(readFileSync(resolve(root,'versions/v2/snapshot.json'),'utf8'));
const apply=process.argv.includes('--apply');
const changed=[];
for(const entry of baseline){
 const preview=resolve(root,'versions/v2',entry.path);
 const data=readFileSync(preview);
 if(createHash('sha256').update(data).digest('hex')!==entry.sha256)changed.push(entry.path);
}
console.log(JSON.stringify({mode:apply?'apply':'review',changed},null,2));
if(apply){
 if(!process.argv.includes('--approved'))throw Error('DO review approval is required: --approved');
 for(const path of changed){
  if(!/^(app|components|hooks|lib|data)\//.test(path)||path.includes('..'))throw Error('Invalid snapshot path');
  const source=resolve(root,'versions/v2',path),target=resolve(root,path);
  const text=readFileSync(source,'utf8').replaceAll('@/versions/v2/','@/');
  mkdirSync(dirname(target),{recursive:true});writeFileSync(target,text);
 }
 console.log('Copied reviewed changes to DO source. Build and deploy separately.');
}
