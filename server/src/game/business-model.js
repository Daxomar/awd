// Numerical customer demand, not autonomous NPCs. No real-money conversion.
export const PERIOD=6*3600000,OFFLINE_PERIODS=8;
export const MODELS={
  provisions:{name:'Provision stall',startup:450,reserve:30,unit:8,price:12,maxPrice:16,capacity:80,demand:5,expense:2,skill:'hustle',locations:['makola'],expand:200},
  food:{name:'Small food joint',startup:900,reserve:30,unit:12,price:22,maxPrice:30,capacity:60,demand:4,expense:3,skill:'cooking',locations:['chopbar','kenkey'],expand:450},
  accessories:{name:'Phone-accessory counter',startup:1500,reserve:30,unit:25,price:40,maxPrice:55,capacity:40,demand:3,expense:4,skill:'coding',locations:['circle','oxford'],expand:750},
};
export function demandPeriod(b,m,{hour,open,noise,skill=0}){
  if(!b.operating||!open||b.till<m.expense)return {units:0,revenue:0,cogs:0,expense:0,paused:!!b.operating&&b.till<m.expense};
  const price=Math.max(0,(m.maxPrice-b.price)/(m.maxPrice-m.price));
  const location=['makola','circle'].includes(b.location)?1:.9;
  const factor=price*location*(1+Math.min(100,b.reputation)/1000)*(1+Math.min(10,Math.floor(skill))*.01)*(b.level?1.15:1);
  const demand=noise<.15?0:Math.min(12,Math.floor(m.demand*(.5+noise)*factor));
  const units=Math.min(b.stock,demand),revenue=units*b.price;
  return {units,revenue,cogs:units*m.unit,expense:m.expense,paused:false,hour};
}
export function periodsToSettle(last,now){
  const end=Math.floor(now/PERIOD)-1;
  return {end,skipped:Math.max(0,end-last-OFFLINE_PERIODS),periods:Array.from({length:Math.max(0,Math.min(OFFLINE_PERIODS,end-last))},(_,i)=>Math.max(last+1,end-OFFLINE_PERIODS+1)+i)};
}
