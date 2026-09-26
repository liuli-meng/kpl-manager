const fs=require('fs');const path=require('path');
const dir='src/js';
for(const f of fs.readdirSync(dir)){
  if(!f.endsWith('.js'))continue;
  const t=fs.readFileSync(path.join(dir,f),'utf8');
  const re=/onclick="[^"]*\$\{p\.(name|id)/g; let m;
  while((m=re.exec(t))){
    const line=t.slice(0,m.index).split('\n').length;
    console.log(f+':'+line+' '+m[0].slice(0,90));
  }
}
console.log('----late----');
