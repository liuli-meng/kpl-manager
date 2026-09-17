/* 批量把 s.players.find(x=>x.id===ID) 换成 findPlayer(s,ID)（rewrite 源码） */
const fs = require('fs');
const path = require('path');
const root = 'E:/sex/kpl-manager-rewrite/src/js';
const files = [];
function walk(d){
  for(const n of fs.readdirSync(d)){
    const p = path.join(d,n);
    if(fs.statSync(p).isDirectory()) walk(p);
    else if(n.endsWith('.js')) files.push(p);
  }
}
walk(root);
const re1 = /(\w+)\.players\.find\((?:x|p)=>x\.id===([^\)]+)\)/g;
const re2 = /(\w+)\.players\.find\((?:x|p)=>p\.id===([^\)]+)\)/g;
let changed = 0;
for(const f of files){
  let src = fs.readFileSync(f,'utf8');
  const before = src;
  src = src.replace(re1, (m,obj,id)=>`findPlayer(${obj},${id})`);
  src = src.replace(re2, (m,obj,id)=>`findPlayer(${obj},${id})`);
  if(src!==before){
    fs.writeFileSync(f,src,'utf8');
    changed++;
    console.log('updated', path.relative(root,f));
  }
}
console.log('files changed', changed);
