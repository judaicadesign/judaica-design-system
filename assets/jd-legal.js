/* Calendar-month validity, independent of the browser's timezone. */
(function(root){
 'use strict';
 function today(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=type=>parts.find(p=>p.type===type).value;
  return get('year')+'-'+get('month')+'-'+get('day');
 }
 function nextMonth(iso){
  const [y,m,d]=iso.split('-').map(Number),next=new Date(Date.UTC(y,m,1));
  const last=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();
  return next.getUTCFullYear()+'-'+String(next.getUTCMonth()+1).padStart(2,'0')+'-'+String(Math.min(d,last)).padStart(2,'0');
 }
 const display=iso=>iso.split('-').reverse().map(Number).join('/');
 function resolve(clauses,issuedDate){return (clauses||[]).map(([title,body])=>[title,String(body).replaceAll('{{vencimiento}}',display(nextMonth(issuedDate)))]);}
 const api={today,nextMonth,display,resolve};
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.jdLegalDates=api;
})(typeof window!=='undefined'?window:null);
