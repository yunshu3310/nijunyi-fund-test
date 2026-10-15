const Q=id=>document.getElementById(id);let latestResult=null,quotes={},quoteError=null;
const money=v=>Number.isFinite(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}):'--';
const pct=v=>(v>=0?'+':'')+(v*100).toFixed(2)+'%';
function paint(id,value,text){Q(id).textContent=text;Q(id).style.color=value>0?'var(--red)':value<0?'var(--green)':'var(--fg)';}
let account;try{account=JSON.parse(localStorage.getItem('nijunyi-paper-v1'));if(!account||account.version!==1||!Number.isFinite(account.cash)||!account.positions||!Array.isArray(account.trades))account=null}catch(e){}
account=account||QuantCore.emptyAccount(100000);
function persist(next){try{localStorage.setItem('nijunyi-paper-v1',JSON.stringify(next));account=next;}catch(e){throw Error('浏览器无法保存模拟账户，请允许本地存储');}}
function tableRows(id,rows,empty){const body=Q(id);body.replaceChildren();if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.textContent=empty;td.className='muted';tr.append(td);body.append(tr);return;}for(const values of rows){const tr=document.createElement('tr');for(const value of values){const td=document.createElement('td');td.textContent=value;tr.append(td)}body.append(tr)}}
async function fetchBars(code){
 const payload=JSON.parse(await marketRequest('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh'+code+',day,,,360,qfq'));
 const data=payload.data?.['sh'+code];if(!data)throw Error('未获得日线数据');
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return (data.qfqday||data.day||[]).filter(row=>row[0]<day).map(row=>({date:row[0],open:Number(row[1]),close:Number(row[2])}));
}
Q('backtestForm').addEventListener('submit',async event=>{
 event.preventDefault();Q('run').disabled=true;Q('backtestStatus').textContent='正在下载完整日线并计算……';Q('backtestStatus').style.color='var(--sub)';
 try{
  const settings={fast:Number(Q('fast').value),slow:Number(Q('slow').value),capital:Number(Q('capital').value),feeRate:Number(Q('fee').value)/100,minFee:Number(Q('minFee').value),slippage:Number(Q('slippage').value)/100,days:Number(Q('days').value)};
  const bars=await fetchBars(Q('symbol').value);latestResult=QuantCore.backtest(bars,settings);
  paint('return',latestResult.returnRate,pct(latestResult.returnRate));paint('benchmark',latestResult.benchmarkReturn,pct(latestResult.benchmarkReturn));Q('drawdown').textContent=(latestResult.maxDrawdown*100).toFixed(2)+'%';Q('tradeCount').textContent=latestResult.trades.length+' / ¥'+money(latestResult.totalFees);
  tableRows('trades',latestResult.trades.map(t=>[t.date,t.signalDate,t.side,t.shares,t.price.toFixed(3),money(t.fee),t.profit===null?'--':money(t.profit)]),'本区间没有均线交叉，策略保持现金');
  Q('backtestStatus').textContent=latestResult.start+' 至 '+latestResult.end+' · '+latestResult.curve.length+'个交易日 · 期末持仓 '+latestResult.remainingShares+'份 · 数据源：腾讯';
  Q('curveEmpty').style.display='none';Q('export').disabled=false;drawEquity();
 }catch(e){Q('backtestStatus').textContent='回测失败：'+e.message;Q('backtestStatus').style.color='var(--red)';}finally{Q('run').disabled=false;}
});
function drawEquity(){
 const c=Q('equityChart'),rect=c.getBoundingClientRect(),dpr=devicePixelRatio||1;c.width=rect.width*dpr;c.height=rect.height*dpr;const ctx=c.getContext('2d');ctx.scale(dpr,dpr);if(!latestResult)return;
 const rows=latestResult.curve,w=rect.width,h=rect.height,L=80,R=16,T=18,B=36;const values=rows.flatMap(r=>[r.equity,r.benchmark]);const low=Math.min(...values),high=Math.max(...values),pad=Math.max((high-low)*.1,latestResult.capital*.005),min=low-pad,max=high+pad;
 const x=i=>L+i/(rows.length-1)*(w-L-R),y=v=>T+(max-v)/(max-min)*(h-T-B);ctx.font='11px Consolas,monospace';
 for(let i=0;i<=4;i++){const yy=T+(h-T-B)*i/4;ctx.strokeStyle='#2b3543';ctx.beginPath();ctx.moveTo(L,yy);ctx.lineTo(w-R,yy);ctx.stroke();ctx.fillStyle='#8a96a8';ctx.textAlign='right';ctx.fillText(Math.round(max-(max-min)*i/4).toLocaleString('zh-CN'),L-10,yy+4);}
 for(let i=0;i<4;i++){const index=Math.round(i/3*(rows.length-1));ctx.fillStyle='#8a96a8';ctx.textAlign=i===0?'left':i===3?'right':'center';ctx.fillText(rows[index].date,x(index),h-10);}
 for(const [field,color] of [['benchmark','#62a9ff'],['equity','#ffd24a']]){ctx.strokeStyle=color;ctx.lineWidth=1.6;ctx.beginPath();rows.forEach((row,i)=>i?ctx.lineTo(x(i),y(row[field])):ctx.moveTo(x(i),y(row[field])));ctx.stroke();}
}
new ResizeObserver(drawEquity).observe(Q('equityChart'));
function downloadCSV(name,rows){const content='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
Q('export').onclick=()=>{if(latestResult)downloadCSV('策略回测.csv',[['日期','策略资产','买入持有资产'],...latestResult.curve.map(r=>[r.date,r.equity,r.benchmark])])};
function renderAccount(){
 let marketValue=0,missing=false;const rows=[];
 for(const [code,p] of Object.entries(account.positions)){const q=quotes[code],value=q?p.shares*q.price:null;if(value===null)missing=true;else marketValue+=value;rows.push([code+' '+marketNames[code],p.shares,money(p.cost/p.shares),q?q.price.toFixed(3):'--',money(value),value===null?'--':money(value-p.cost)]);}
 paint('paperCash',0,money(account.cash));paint('paperRealized',account.realized,money(account.realized));Q('paperEquity').textContent=missing?'等待报价':money(account.cash+marketValue);const profit=account.cash+marketValue-account.initial;paint('paperProfit',missing?0:profit,missing?'等待报价':money(profit));tableRows('positions',rows,'暂无模拟持仓，先记录一笔模拟交易');
}
async function refreshPaper(){try{const r=await marketFetch('/api/funds'),data=await r.json();for(const item of data){if(item.quote)quotes[item.code]=item.quote;}quoteError=null;renderAccount();Q('paperStatus').textContent='模拟初始资金 '+money(account.initial)+' 元 · 每5秒尝试估值 · 行情时间 '+(quotes['513310']?.quote_time.replace('T',' ')||'等待');}catch(e){quoteError=e.message;Q('paperStatus').textContent='行情连接失败：'+e.message+'；已有估值可能过期';}finally{setTimeout(refreshPaper,5000)}}
Q('paperForm').addEventListener('submit',async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;try{
 const code=Q('paperCode').value;const quote=marketParse(await marketRequest('https://qt.gtimg.cn/q=sh'+code,'gbk'),code);
 const marketTime=new Date(quote.quote_time+'+08:00').getTime();if(Date.now()-marketTime>120000||marketTime>Date.now()+60000)throw Error('行情超过两分钟未更新，请在交易时段使用');
 const order={code,side:Q('side').value,shares:Number(Q('shares').value),price:quote.price,feeRate:Number(Q('paperFee').value)/100,minFee:Number(Q('paperMinFee').value),time:quote.quote_time};persist(QuantCore.paperTrade(account,order));quotes[code]=quote;renderAccount();Q('paperStatus').textContent='已记录模拟'+(order.side==='buy'?'买入':'卖出')+' '+order.shares+'份，价格 '+order.price.toFixed(3)+' 元';
 }catch(e){Q('paperStatus').textContent='模拟交易未记录：'+e.message;}finally{button.disabled=false;}});
Q('paperExport').onclick=()=>downloadCSV('模拟交易.csv',[['时间','代码','方向','数量','价格','佣金'],...account.trades.map(t=>[t.time,t.code,t.side,t.shares,t.price,t.fee])]);
Q('reset').onclick=()=>{if(confirm('重置将清空此浏览器的模拟持仓和交易记录，确定吗？')){try{persist(QuantCore.emptyAccount(100000));renderAccount();Q('paperStatus').textContent='模拟账户已重置';}catch(e){Q('paperStatus').textContent=e.message;}}};
renderAccount();refreshPaper();
