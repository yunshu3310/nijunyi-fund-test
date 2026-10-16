document.addEventListener('click',event=>{
 const link=event.target.closest('a[data-mini-window]');if(!link)return;
 event.preventDefault();
 const width=Math.max(360,Math.round(screen.availWidth*0.4));
 const height=Math.max(280,Math.round(screen.availHeight*0.3125));
 const left=Math.max(0,screen.availWidth-width-20),top=40;
 const win=window.open(link.href,'nijunyi-mini-quotes',`popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
 if(win)win.focus();else location.href=link.href;
});
