/* Browser-only GitHub Pages quote adapter. No credentials or server required. */
const marketCodes = ['513310', '515050', '588170', '000001'];
const marketNames = {'513310':'中韩半导体ETF华泰柏瑞','515050':'通信ETF华夏','588170':'科创半导体ETF华夏','000001':'上证指数'};
const marketTicks = new Map(), marketMinutes = new Map(), marketComments = new Map();
async function marketRequest(url, encoding='utf-8') {
  const r = await fetch(url, {signal:AbortSignal.timeout(10000)});
  if(!r.ok) throw Error('行情接口返回 '+r.status);
  return new TextDecoder(encoding).decode(await r.arrayBuffer());
}
function marketParse(text, code) {
  const match = text.match(new RegExp('v_sh'+code+'="([^\"]+)"'));
  if(!match) throw Error('暂无 '+code+' 行情');
  const f=match[1].split('~');
  if(f[2]!==code||!Number.isFinite(Number(f[3]))||Number(f[3])<=0) throw Error('行情数据异常');
  const t=f[30];
  const time=t.slice(0,4)+'-'+t.slice(4,6)+'-'+t.slice(6,8)+'T'+t.slice(8,10)+':'+t.slice(10,12)+':'+t.slice(12,14);
  const levels=start=>Array.from({length:5},(_,i)=>({price:Number(f[start+i*2])||null,volume:Number.isFinite(Number(f[start+i*2+1]))?Number(f[start+i*2+1]):null}));
  return {code,name:f[1],price:Number(f[3]),previous_close:Number(f[4]),quote_time:time,kind:code==='000001'?'index':'fund',bids:code==='000001'?[]:levels(9),asks:code==='000001'?[]:levels(19)};
}
async function marketHistory(code, quote) {
  const cached=marketMinutes.get(code);
  if(!cached||Date.now()-cached.updated>30000||cached.day!==quote.quote_time.slice(0,10)) {
    try {
      const data=JSON.parse(await marketRequest('https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=sh'+code)).data['sh'+code].data;
      const day=data.date.slice(0,4)+'-'+data.date.slice(4,6)+'-'+data.date.slice(6,8);
      const points=data.data.map(line=>{const v=line.split(' ');return {time:day+'T'+v[0].slice(0,2)+':'+v[0].slice(2)+':00',price:Number(v[1])}}).filter(p=>p.time<=quote.quote_time&&p.price>0);
      marketMinutes.set(code,{day,points,updated:Date.now()});
    } catch(e) {if(!cached) throw e;}
  }
  let ticks=marketTicks.get(code)||[];
  ticks=ticks.filter(p=>p.time.slice(0,10)===quote.quote_time.slice(0,10));
  if(!ticks.length||ticks.at(-1).time!==quote.quote_time) ticks.push({time:quote.quote_time,price:quote.price});
  if(ticks.length>21600)ticks=ticks.slice(-21600);
  marketTicks.set(code,ticks);
  const minuteData=marketMinutes.get(code);
  const minutes=minuteData?.day===quote.quote_time.slice(0,10)?minuteData.points:[];
  return [...minutes.filter(p=>p.time.slice(0,16)<ticks[0].time.slice(0,16)),...ticks];
}
async function marketComment(code) {
  if(code==='000001')return null;
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const key='fund-comment-v1-'+code+'-'+day;
  if(marketComments.has(key))return marketComments.get(key);
  try {
    let stored=null;try{stored=JSON.parse(localStorage.getItem(key))}catch(e){}
    if(stored){marketComments.set(key,stored);return stored;}
    const d=JSON.parse(await marketRequest('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh'+code+',day,,,40,qfq')).data['sh'+code];
    const bars=(d.qfqday||d.day||[]).filter(r=>r[0]<day).sort((a,b)=>a[0].localeCompare(b[0]));
    if(bars.length<20)throw Error('数据不足');
    const closes=bars.slice(-20).map(r=>Number(r[2]));if(closes.some(v=>!Number.isFinite(v)||v<=0))throw Error('价格无效');
    const ma5=closes.slice(-5).reduce((a,b)=>a+b,0)/5,ma20=closes.reduce((a,b)=>a+b,0)/20,last=closes.at(-1),change=last/closes.at(-2)-1;
    let action='不动',text='不动参考：走势信号尚不一致，等待方向明确。';
    if(last>ma5&&ma5>ma20&&change>0&&change<=.03){action='买入';text='买入参考：均线向上且温和上涨，可考虑分批。'}
    else if(last<ma5&&ma5<ma20&&change<0){action='卖出';text='卖出参考：均线走弱且收盘下跌，可考虑减仓。'}
    const result={day,based_on:bars.at(-1)[0],action,text};
    marketComments.set(key,result);try{localStorage.setItem(key,JSON.stringify(result))}catch(e){}
    return result;
  }catch(e){return {day,action:'等待',text:'评价暂不可用：日线数据不足或接口异常。'};}
}
async function marketFetch(path) {
  let result;
  if(path.startsWith('/api/funds')) {
    const text=await marketRequest('https://qt.gtimg.cn/q='+marketCodes.map(c=>'sh'+c).join(','),'gbk');
    result=marketCodes.map(code=>{try{const quote=marketParse(text,code);return {code,name:quote.name,quote,error:null};}catch(e){return {code,name:marketNames[code],quote:null,error:e.message};}});
  } else {
    const code=new URL(path,location.origin).searchParams.get('code');
    if(!marketCodes.includes(code))throw Error('不支持的代码');
    const quote=marketParse(await marketRequest('https://qt.gtimg.cn/q=sh'+code,'gbk'),code);
    let history=[],error=null;
    try{history=await marketHistory(code,quote);}catch(e){error='分时数据暂不可用，正在重试';}
    result={quote,history,error,comment:await marketComment(code)};
  }
  return {ok:true,json:async()=>result};
}
