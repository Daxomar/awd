import {WORKPLACES} from '../../../shared/workplaces.js';
export function currentTask(s){
  const sh=s.shift,work=WORKPLACES[s.job?.id];if(!sh||!work)return null;
  const index=(sh.completedTasks||[]).length,task=work.tasks[index];
  if(!task||sh.worked<index*10)return null;
  return {...task,id:`${sh.start}:${index}`,station:{x:work.x,z:work.z,label:work.label},index};
}
export function taskView(s){
  const t=currentTask(s);if(!t)return null;
  return {id:t.id,title:t.title,situation:t.situation,choices:t.choices,seconds:t.seconds,station:t.station,index:t.index,
    stage:s.shift.activeTask?.id===t.id?'working':'assigned',readyAt:s.shift.activeTask?.readyAt||null};
}
const nearStation=(p,t)=>Number.isFinite(p.rx)&&Number.isFinite(p.rz)&&Math.hypot(p.rx-t.station.x,p.rz-t.station.z)<=3;
export function beginTask(p,msg,career,now){
  const s=p.state,t=currentTask(s);
  if(!t||msg.id!==t.id)return 'That assignment is no longer available.';
  if(s.place!==career.at||!nearStation(p,t))return 'Walk to the workplace station first.';
  if(s.shift.activeTask)return 'An assignment is already in progress.';
  if(!Number.isInteger(msg.choice)||msg.choice<0||msg.choice>=t.choices.length)return 'Choose an assignment approach.';
  s.shift.activeTask={id:t.id,choice:msg.choice,readyAt:now+t.seconds*1000};return null;
}
export function tickTask(p,career,now){
  const s=p.state,active=s.shift?.activeTask,t=currentTask(s);if(!active||!t)return null;
  if(s.place!==career.at||!nearStation(p,t)){s.shift.activeTask=null;return {interrupted:true};}
  if(now<active.readyAt)return null;
  s.shift.completedTasks||=[];
  if(active.id!==t.id||s.shift.completedTasks.includes(t.id)){s.shift.activeTask=null;return null;}
  s.shift.completedTasks.push(t.id);s.shift.tasks=s.shift.completedTasks.length;s.shift.activeTask=null;
  const quality=active.choice===t.best;
  s.job.perf=Math.max(0,Math.min(100,s.job.perf+(quality?3:1)));
  s.job.satisfaction=Math.max(0,Math.min(100,(s.job.satisfaction??60)+(quality?2:-1)));
  return {completed:t.id,quality,skill:career.skill};
}
