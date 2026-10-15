const HoldingsCore=(()=>{
 function exchange(code){if(!/^\d{6}$/.test(code)||!(/^(5\d|15|16|18)/.test(code)))throw Error('请输入六位场内基金代码，例如513310或159915');return code[0]==='5'?'sh':'sz';}
 function create(code,amount,quote,id){exchange(code);if(!Number.isFinite(amount)||amount<=0)throw Error('持仓金额必须大于零');if(quote.code!==code||!Number.isFinite(quote.previous_close)||quote.previous_close<=0)throw Error('无法取得有效昨收价');return {id,code,name:quote.name,amount,shares:amount/quote.previous_close,basePrice:quote.previous_close,baseDate:quote.quote_time.slice(0,10)};}
 function value(item,quote){if(!quote||quote.code!==item.code||!Number.isFinite(quote.price)||quote.price<=0||!Number.isFinite(quote.previous_close)||quote.previous_close<=0)return null;return {profit:item.shares*(quote.price-quote.previous_close),value:item.shares*quote.price,rate:quote.price/quote.previous_close-1};}
 return {exchange,create,value};
})();
