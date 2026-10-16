const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const wait=()=>new Promise(r=>setTimeout(r,120));
(async()=>{
 const dom=new JSDOM('<main><div id="quotePreview"><div class="jd-master-sheet"><p>Semantic PDF source</p></div></div></main>',{runScripts:'outside-only'}),w=dom.window;
 let calls=0;w.jdNativeQuote={readSheet:()=>({})};w.jdQuotePreviewSVG=async()=>{calls++;return '<svg class="jd-master-art" viewBox="0 0 595 842"></svg>';};
 w.eval(fs.readFileSync('assets/jd-quote-fit.js','utf8'));await w.jdRefreshQuoteArt();assert.equal(w.document.querySelectorAll('.jd-master-art').length,1);
 // Product/variant save rebuilds the quote form and replaces the preview node.
 const old=w.document.getElementById('quotePreview');old.outerHTML='<div id="quotePreview"><div class="jd-master-sheet"><p>New quote source</p></div></div>';
 w.document.dispatchEvent(new w.Event('jd-quote-rendered'));await wait();assert.equal(w.document.querySelectorAll('#quotePreview .jd-master-art').length,1);assert.ok(calls>=2);
 w.jdQuotePreviewSVG=async()=>{throw Error('Test font/network failure')};await w.jdRefreshQuoteArt();assert.equal(w.document.querySelectorAll('.jd-master-art').length,0);assert.match(w.document.querySelector('.jd-preview-error').textContent,/Test font\/network failure/);assert.equal(w.document.querySelector('.jd-master-sheet').getAttribute('aria-busy'),'false');
 w.jdQuotePreviewSVG=async()=>'<svg class="jd-master-art"></svg>';await w.document.querySelector('.jd-preview-error button').onclick();assert.equal(w.document.querySelector('.jd-preview-error'),null);
 const css=fs.readFileSync('assets/jd-quote-layout.css','utf8');assert.match(css,/#quotePreview \.jd-master-sheet\{[^}]*aspect-ratio:[^}]*overflow:hidden/s);assert.match(css,/:not\(\.jd-preview-loading\):not\(\.jd-preview-error\)\{visibility:hidden/);
 dom.window.close();console.log('PASS preview reconnects after form replacement, failure/retry removes stale SVG, and A4 preview cannot expose overflowing HTML fallback.');
})().catch(e=>{console.error(e);process.exit(1)});
