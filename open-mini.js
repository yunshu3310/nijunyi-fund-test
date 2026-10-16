document.addEventListener('click',event=>{
 const link=event.target.closest('a[data-mini-window]');if(!link)return;
 event.preventDefault();
 let frame=document.getElementById('miniQuoteOverlay');
 if(frame){frame.remove();link.setAttribute('aria-expanded','false');return;}
 const width=Math.min(innerWidth-16,Math.max(300,Math.round(screen.availWidth*.2)));
 const height=Math.min(innerHeight-80,Math.max(260,Math.round(screen.availHeight*.3125)));
 frame=document.createElement('iframe');frame.id='miniQuoteOverlay';frame.title='四基金行情小窗';
 frame.src=new URL('mini.html?compact=1',link.href).href;
 frame.style.cssText=`position:fixed;right:12px;top:70px;width:${width}px;height:${height}px;border:1px solid #344052;border-radius:4px;background:#101318;z-index:10000;box-shadow:0 8px 24px #0008;`;
 document.body.append(frame);link.setAttribute('aria-expanded','true');
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')document.getElementById('miniQuoteOverlay')?.remove();});
