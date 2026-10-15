const SearchCore=(()=>{
 function parse(hint){if(typeof hint!=='string')return [];const seen=new Set();return hint.split('^').map(row=>{const f=row.split('~');return {exchange:f[0],code:f[1],name:f[2],type:f[4]};}).filter(item=>{if(!['sh','sz'].includes(item.exchange)||!/^\d{6}$/.test(item.code)||!(/^(5\d|15|16|18)/.test(item.code))||!item.name||seen.has(item.code))return false;seen.add(item.code);return true;});}
 function remember(records,item){const key=v=>v.kind==='fund'?'fund:'+v.code:'query:'+v.query;return [{...item},...records.filter(v=>key(v)!==key(item))].slice(0,20);}
 return {parse,remember};
})();
