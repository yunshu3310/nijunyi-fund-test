/* Pure calculations. Strategies use previous completed close, execute at next open. */
const QuantCore=(()=>{
 const valid=(value,label,min=0)=>{if(!Number.isFinite(value)||value<min)throw Error(label+'无效');return value};
 const commission=(amount,s)=>Math.max(amount*s.feeRate,s.minFee);
 function metrics(curve,capital){let peak=capital,maxDrawdown=0;for(const p of curve){peak=Math.max(peak,p.equity);maxDrawdown=Math.max(maxDrawdown,(peak-p.equity)/peak)}return {returnRate:curve.at(-1).equity/capital-1,maxDrawdown};}
 function backtest(input,s){
  for(const key of ['capital','feeRate','minFee','slippage'])valid(s[key],key);if(s.capital<=0||s.slippage>=1||s.feeRate>=1)throw Error('资金或费率超出范围');
  if(!Number.isInteger(s.fast)||!Number.isInteger(s.slow)||s.fast<2||s.slow<=s.fast||!Number.isInteger(s.days)||s.days<2)throw Error('短均线须小于长均线，区间至少两日');
  const bars=input.map(b=>({...b})).sort((a,b)=>a.date.localeCompare(b.date));
  if(new Set(bars.map(b=>b.date)).size!==bars.length)throw Error('日线日期重复');
  bars.forEach(b=>{if(!b.open||!b.close)throw Error('日线缺少价格');valid(b.open,'开盘');valid(b.close,'收盘')});
  const begin=Math.max(s.slow+1,bars.length-s.days);if(bars.length-begin<2)throw Error('日线不足，请缩短均线或区间');
  const mean=(end,n)=>bars.slice(end-n+1,end+1).reduce((a,b)=>a+b.close,0)/n;
  let cash=s.capital,shares=0,cost=0,totalFees=0;const trades=[],curve=[];
  let benchmarkCash=s.capital,benchmarkShares=0;
  for(let i=begin;i<bars.length;i++){
   const bar=bars[i],prev=i-1;
   const fast=mean(prev,s.fast),slow=mean(prev,s.slow),priorFast=mean(prev-1,s.fast),priorSlow=mean(prev-1,s.slow);
   const buy=fast>slow&&priorFast<=priorSlow,sell=fast<slow&&priorFast>=priorSlow;
   if(buy&&!shares){const price=bar.open*(1+s.slippage);let quantity=Math.floor(cash/(price*(1+s.feeRate))/100)*100;
    while(quantity>0&&quantity*price+commission(quantity*price,s)>cash)quantity-=100;
    if(quantity>0){const fee=commission(quantity*price,s);cash-=quantity*price+fee;shares=quantity;cost=quantity*price+fee;totalFees+=fee;trades.push({date:bar.date,signalDate:bars[prev].date,side:'买入',shares,price,fee,profit:null});}
   }else if(sell&&shares){const price=bar.open*(1-s.slippage),fee=commission(shares*price,s),proceeds=shares*price-fee;cash+=proceeds;totalFees+=fee;trades.push({date:bar.date,signalDate:bars[prev].date,side:'卖出',shares,price,fee,profit:proceeds-cost});shares=0;cost=0;}
   if(i===begin){const price=bar.open*(1+s.slippage);benchmarkShares=Math.floor(benchmarkCash/(price*(1+s.feeRate))/100)*100;while(benchmarkShares>0&&benchmarkShares*price+commission(benchmarkShares*price,s)>benchmarkCash)benchmarkShares-=100;if(benchmarkShares)benchmarkCash-=benchmarkShares*price+commission(benchmarkShares*price,s);}
   curve.push({date:bar.date,equity:cash+shares*bar.close,benchmark:benchmarkCash+benchmarkShares*bar.close});
  }
  return {...metrics(curve,s.capital),curve,trades,totalFees,capital:s.capital,start:bars[begin].date,end:bars.at(-1).date,remainingShares:shares,benchmarkReturn:curve.at(-1).benchmark/s.capital-1};
 }
 function emptyAccount(capital){valid(capital,'初始资金',1);return {version:1,initial:capital,cash:capital,realized:0,positions:{},trades:[]};}
 function paperTrade(input,order){
  const a=JSON.parse(JSON.stringify(input));valid(order.price,'价格',.000001);valid(order.feeRate,'费率');valid(order.minFee,'最低费用');
  if(!['513310','515050','588170'].includes(order.code)||!['buy','sell'].includes(order.side)||!Number.isInteger(order.shares)||order.shares<=0||order.shares%100!==0||order.feeRate>=1)throw Error('代码、方向、数量或费率无效，数量须为100的倍数');
  const p=a.positions[order.code]||{shares:0,cost:0},amount=order.shares*order.price,fee=commission(amount,order);
  if(order.side==='buy'){if(amount+fee>a.cash)throw Error('模拟余额不足');a.cash-=amount+fee;p.shares+=order.shares;p.cost+=amount+fee;}
  else{if(order.shares>p.shares)throw Error('模拟持仓不足');const basis=p.cost/p.shares*order.shares;a.cash+=amount-fee;a.realized+=amount-fee-basis;p.shares-=order.shares;p.cost-=basis;}
  if(p.shares)a.positions[order.code]=p;else delete a.positions[order.code];
  a.trades.push({...order,fee});return a;
 }
 return {backtest,metrics,emptyAccount,paperTrade};
})();
