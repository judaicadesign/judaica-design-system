'use strict';
// Build an editorial linked Birkát Hamazón view from Tehilim FINAL without touching source masters.
// Usage: node scripts/export-linked-master.cjs [--language hebrew|phonetic] [--check | --write]
const fs=require('node:fs');
const path=require('node:path');
const links=require('../assets/jd-passage-links.js');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(read('masters/compositions/BIRKAT_HAMAZON_ASHKENAZI.json'));
const corpus=JSON.parse(read('masters/tehilim/tehilim.json'));
const states=JSON.parse(read('masters/tehilim/REVISION_ESTADO.json'));
const opts=process.argv.slice(2);
const l=opts.indexOf('--language');
const language=l>=0?opts[l+1]:'hebrew';
if(!['hebrew','phonetic'].includes(language))throw new Error('Use --language hebrew|phonetic');
const cfg=manifest.languages[language];
const resolved=links.compose({body:read(cfg.source),language,spec:{...cfg,documentId:manifest.documentId},corpus,states});
const output='masters/bircat-hamazon/ASHKENAZ_'+(language==='hebrew'?'HEBREO':'FONETICA')+'_VINCULADO_EN_REVISION.txt';
if(opts.includes('--check')){
 if(language!=='hebrew')throw new Error('Only the Hebrew snapshot is currently checked in; phonetic closure comes later.');
 if(read(output)!==resolved.text)throw new Error(output+' no longer matches Tehilim FINAL; regenerate and review.');
 console.log('PASS linked Hebrew, 137/126 FINAL, local contexts preserved.');
}else if(opts.includes('--write')){
 if(language!=='hebrew')throw new Error('Do not publish phonetic snapshot before independent approval.');
 fs.writeFileSync(path.join(root,output),resolved.text,'utf8');
 console.log('Wrote REVIEW ONLY '+output+'; no FINAL is implied.');
}else process.stdout.write(resolved.text);
