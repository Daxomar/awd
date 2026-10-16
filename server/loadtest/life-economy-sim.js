// Scenario model using unchanged catalogue prices and the actual bounded demand
// function. This is not a claim to simulate autonomous customers or real Ghana prices.
import fs from 'node:fs';
import * as D from '../src/game/data.js';
import * as Game from '../src/game/rules.js';
import {MODELS,PERIOD,demandPeriod} from '../src/game/business-model.js';
const DAYS=28,TRIALS=30,BASE=Date.UTC(2026,9,19);
const STYLES={employment:{days:[0,1,2,3,4],visits:7,business:false},business:{days:[0,2,4],visits:7,business:true},social:{days:[1,4],visits:7,business:false},mixed:{days:[0,1,3,4],visits:7,business:true},casual:{days:[1,4],visits:2,business:true}};
function simulate(origin,style,seed){
 const o=D.ORIGINS[origin],h=D.HOMES[o.homes[0]],m=MODELS.provisions,cfg=STYLES[style];
 let cash=o.cash+o.momo,earned=0,spent=0,bankrupt=0,biz=null,sales=0,profit=0,lastVisit=-1,firstBusiness=null,housingDay=null,unpaidRent=0,weekIncome=0;
 const cost=(amount)=>{if(cash>=amount){cash-=amount;spent+=amount;return true;}return false;};
 for(let day=0;day<DAYS;day++){
  const weekday=day%7,visit=cfg.visits===7||[1,4].includes(weekday),work=visit&&cfg.days.includes(weekday);
  if(visit){
   // An online day has one active meal. Three capped offline meals per return
   // mirror the current onJoin cap, even after several days away.
   if(lastVisit>=0){for(let meal=0;meal<3;meal++)cost(22);}lastVisit=day;
   if(work){const pay=D.CAREERS.tech.ranks[0][1];cash+=pay;earned+=pay;weekIncome+=pay;}
   cost(20);cost(8); // existing small waakye and data-bundle bands, conservative daily data assumption
   if(cfg.business&&!biz&&cash>=m.startup+10*m.unit+h.rent){cost(m.startup);cost(10*m.unit);biz={operating:true,price:m.price,stock:10,till:m.reserve,reputation:0,level:0,location:'makola',last:Math.floor((BASE+day*86400000)/PERIOD)};firstBusiness=day;}
   if(biz){
    const end=Math.floor((BASE+(day+1)*86400000)/PERIOD)-1,start=Math.max(biz.last+1,end-7);
    for(let period=start;period<=end;period++){
     const mid=period*PERIOD+PERIOD/2,noise=((Math.imul(period+seed*8191,1664525)+1013904223)>>>0)/4294967296;
     const out=demandPeriod(biz,m,{hour:new Date(mid).getUTCHours(),open:Game.isOpen(Game.LOC.makola,mid),noise,skill:0});
     biz.stock-=out.units;biz.till+=out.revenue-out.expense;sales+=out.units;profit+=out.revenue-out.cogs-out.expense;
    }biz.last=end;
    const withdrawal=Math.max(0,biz.till-m.reserve);cash+=withdrawal;biz.till-=withdrawal;
    const replenish=Math.min(10-biz.stock,Math.floor(Math.max(0,cash-h.rent-86)/m.unit));if(replenish>0){cost(replenish*m.unit);biz.stock+=replenish;}
   }
  }
  if(weekday===6){if(!cost(h.rent))unpaidRent++;let inc=weekIncome,tax=0;for(const [width,rate]of D.TAX_BANDS){const part=Math.min(inc,width);tax+=part*rate;inc-=part;if(inc<=0)break;}cost(Math.round(tax));weekIncome=0;}
  const target=D.HOMES.jtown.rent*D.HOMES.jtown.advance;if(housingDay===null&&cash>=target)housingDay=day;
  if(cash<20)bankrupt++;
 }
 return {origin,style,initial:o.cash+o.momo,home:o.homes[0],weeklyRent:h.rent,endingWallet:cash,earnedSalary:earned,personalOutflow:spent,businessSales:sales,operatingProfit:profit,
  businessDay:firstBusiness,housingAdvanceAffordableDay:housingDay,daysBelowMealCost:bankrupt,unpaidRentPeriods:unpaidRent,
  liquidAndStock:cash+(biz?biz.till+biz.stock*m.unit:0)};
}
const runs=[];for(const origin of ['hustler','dbee'])for(const style in STYLES)for(let seed=0;seed<TRIALS;seed++)runs.push(simulate(origin,style,seed));
const summaries=[];for(const origin of ['hustler','dbee'])for(const style in STYLES){const rows=runs.filter(r=>r.origin===origin&&r.style===style),mean=k=>Math.round(rows.reduce((s,r)=>s+(r[k]||0),0)/rows.length*100)/100;
 const opened=rows.filter(r=>r.businessDay!==null),housing=rows.filter(r=>r.housingAdvanceAffordableDay!==null);
 summaries.push({origin,style,initial:rows[0].initial,home:rows[0].home,weeklyRent:rows[0].weeklyRent,meanWallet:mean('endingWallet'),minWallet:Math.min(...rows.map(r=>r.endingWallet)),salary:mean('earnedSalary'),outflow:mean('personalOutflow'),sales:mean('businessSales'),operatingProfit:mean('operatingProfit'),businessOpened:opened.length,meanBusinessDay:opened.length?opened.reduce((n,r)=>n+r.businessDay,0)/opened.length:null,housingAdvanceAffordableTrials:housing.length,meanHousingAdvanceDay:housing.length?housing.reduce((n,r)=>n+r.housingAdvanceAffordableDay,0)/housing.length:null,rentMisses:mean('unpaidRentPeriods'),daysBelowMealCost:mean('daysBelowMealCost')});}
const wealth=runs.map(r=>r.liquidAndStock).sort((a,b)=>b-a),sum=wealth.reduce((a,b)=>a+b,0);
const report={date:'2026-10-16',days:DAYS,trialsPerScenario:TRIALS,runs:runs.length,cadence:STYLES,
 assumptions:['Natural birth totals and first eligible home from existing catalogue; starting rent advance not deducted in this scenario model.','Existing tech entry salary GH150; one real hour per attended shift on valid weekdays; no invented social income, top-ups, First Friend cash, salary bonuses or speculative trading partners.','No promotions assumed: deliberately conservative. Existing salary/skill promotion rules are unit/integration tested separately.','One active GH20 meal and GH8 data per visit, plus up to three GH22 offline meals per return; weekly rent and existing tax bands. Other transport is walking; discretionary luxury, loans, real payment and random medical/crime outcomes excluded.','Managed business uses actual demandPeriod with transparent deterministic trial noise; daily visitors settle daily, casual visitors settle at two visits/week and lose periods beyond the 48-hour cap. Inventory purchases and till movements are tracked; retained stock is not cash.','Equal-sized start cohorts compare paths; concentration below is not an estimate of the real player population or birth-odds distribution.','Model is a budget stress test, not a full server/NPC/needs simulation. Missed rent is counted without modeling relocation after eviction. Different home choices, careers, play times and purchases materially change results.'],
 summaries,top20PercentLiquidAndStockShare:Math.round(wealth.slice(0,Math.ceil(wealth.length*.2)).reduce((a,b)=>a+b,0)/sum*10000)/100,
 findings:['The starts retain a substantial wealth gap. Wealth is not proof of a profitable operation.','Pure social play with few paid shifts is not financially self-supporting under daily return food costs; existing offline food/rent bands are an approval topic, not silently changed.','A stock-limited provision stall is supplementary income, not a replacement for early employment.','Casual cadence benefits from capped offline meals but misses demand beyond 48 hours. Lower-rent home choices matter.'],
 approvalRecommendations:['Review offline-food burden and basic-career wage viability across all existing ranks before production; keep existing values until approved.','Physical-device and live concurrency/load testing before release.']};
fs.mkdirSync('docs/phase8',{recursive:true});fs.writeFileSync('docs/phase8/economy-simulation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({runs:report.runs,summaries},null,2));
