// Read rows in visual order; PDF stream order may place an amount before its label.
export async function budgetPage(page){
 const content=await page.getTextContent({normalizeWhitespace:true}),rows=new Map();
 for(const item of content.items){const y=Math.round(item.transform[5]*10)/10,key=[...rows.keys()].find(v=>Math.abs(v-y)<2)??y;if(!rows.has(key))rows.set(key,[]);rows.get(key).push(item);}
 return [...rows].sort((a,b)=>b[0]-a[0]).map(([,items])=>items.sort((a,b)=>a.transform[4]-b.transform[4]).map(x=>x.str).join(' ')).join('\n');
}
export function budgetTotals(text,code){
 if(!new RegExp('N[°º]?\\s*'+String(code)+'(?!\\d)').test(text))throw Error('El PDF no corresponde al código solicitado');
 const amount=label=>{const matches=[...text.matchAll(new RegExp('TOTAL\\s+'+label+'\\s*\\$?\\s*([\\d.,]+)','gi'))];if(matches.length!==1)throw Error('No se pudo identificar un total único: '+label);const raw=matches[0][1];if(!/^\d{1,3}(?:,\d{3})*\.\d{2}$|^\d+\.\d{2}$/.test(raw))throw Error('Formato de importe B612 no reconocido');return Number(raw.replace(/,/g,''));};
 const net=amount('SIN\\s+IVA'),gross=amount('CON\\s+IVA');if(net<=0||gross<net)throw Error('Los totales del PDF no son consistentes');return {net,gross,vat:Math.round((gross-net)*100)/100,budgetCode:String(code)};
}
