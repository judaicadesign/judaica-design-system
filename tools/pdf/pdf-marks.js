/* Heuristic recognition of standard vector crop marks; never proves absence. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.JDPDFMarks=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const ID=[1,0,0,1,0,0],MM=72/25.4;
 const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
 function detect(list,ops,trim){
  let matrix=ID.slice(),stack=[],lineWidth=1;const found=new Set();
  const point=(x,y)=>[matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]];
  function candidate(bounds){
   const points=[point(bounds[0],bounds[1]),point(bounds[2],bounds[1]),point(bounds[0],bounds[3]),point(bounds[2],bounds[3])],xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
   const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),w=x1-x0,h=y1-y0,tol=.8,max=18*MM;
   if(w>=1.5*MM&&w<=12*MM&&h<=tol){const y=(y0+y1)/2,side=x1<trim.x-.2&&trim.x-x0<max?'L':x0>trim.x+trim.width+.2&&x1-trim.x-trim.width<max?'R':null;const edge=Math.abs(y-trim.y)<tol?'B':Math.abs(y-trim.y-trim.height)<tol?'T':null;if(side&&edge)found.add(side+edge+'H');}
   if(h>=1.5*MM&&h<=12*MM&&w<=tol){const x=(x0+x1)/2,side=Math.abs(x-trim.x)<tol?'L':Math.abs(x-trim.x-trim.width)<tol?'R':null,edge=y1<trim.y-.2&&trim.y-y0<max?'B':y0>trim.y+trim.height+.2&&y1-trim.y-trim.height<max?'T':null;if(side&&edge)found.add(side+edge+'V');}
  }
  for(let i=0;i<list.fnArray.length;i++){
   const op=list.fnArray[i],args=list.argsArray[i];
   if(op===ops.save||op===ops.paintFormXObjectBegin){stack.push({matrix:matrix.slice(),lineWidth});if(op===ops.paintFormXObjectBegin&&args?.[0]?.length===6)matrix=multiply(matrix,args[0]);}
   else if(op===ops.restore||op===ops.paintFormXObjectEnd){const s=stack.pop();if(s){matrix=s.matrix;lineWidth=s.lineWidth;}}
   else if(op===ops.transform)matrix=multiply(matrix,args);
   else if(op===ops.setLineWidth)lineWidth=args[0];
   else if(op===ops.constructPath&&Number.isFinite(args?.[2]?.[0])){
    // PDF.js 6.4 fuses painting into constructPath: [paintOp, paths, bbox].
    const paint=args[0];if([ops.stroke,ops.closeStroke,ops.fillStroke,ops.eoFillStroke,ops.closeFillStroke,ops.closeEOFillStroke].includes(paint)&&lineWidth<=2)candidate(args[2]);
   }
  }
  const count=found.size;return{status:count===8?'detected':count>=3?'possible':'not-found',count,positions:[...found]};
 }
 return{detect};
});
