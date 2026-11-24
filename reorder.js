(function(root){
'use strict';
function order(cards,ids,key,id,sold,all){
 const seen=new Set(),protectedCards=[];
 for(const c of cards){if(all||(!sold(c)&&!seen.has(key(c)))){seen.add(key(c));protectedCards.push(c);if(protectedCards.length===12)break;}}
 if(protectedCards.length<12)return cards;
 const fixed=new Set(protectedCards),keys=new Set(protectedCards.map(key)),byId=new Map(cards.map(c=>[id(c),c])),promoted=[];
 for(const i of ids){const c=byId.get(i);if(!c||sold(c)||fixed.has(c)||keys.has(key(c)))continue;keys.add(key(c));promoted.push(c);}
 const moved=new Set(promoted);let boundary=cards.indexOf(protectedCards[11])+1;
 return cards.slice(0,boundary).filter(c=>!moved.has(c)).concat(promoted,cards.slice(boundary).filter(c=>!moved.has(c)));
}
if(typeof module!=='undefined')module.exports=order;
root.fpReorder=async function(grid,more,keyFor,title){
 const cards=()=>Array.from(grid.querySelectorAll(':scope > .product-card'));
 const id=c=>{const a=c.querySelector('a[href*="/items/"]');return a&&((a.getAttribute('href')||'').match(/\/items\/(\d+)/)||[])[1]};
 const key=c=>keyFor(title(c))||id(c)||c;
 const sold=c=>!!c.querySelector('.soldout,.auto-sold-label,.waitingForSale');
 const all=new URLSearchParams(location.search).get('feelport_all')==='1';
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),1800);
 let ids;try{const r=await fetch('https://ebata-tomomi.github.io/feelport-sale-data/reorder_priority.json',{cache:'no-store',signal:ctl.signal});if(!r.ok)return;const j=await r.json();const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);if(j.as_of!==today||!Array.isArray(j.priority_ids)||!j.priority_ids.every(x=>typeof x==='string'&&/^\d+$/.test(x)))return;ids=[...new Set(j.priority_ids)];}catch(e){return;}finally{clearTimeout(timer);}
 if(!ids.length)return;
 const button=more&&more.querySelector('[data-load-items-trigger]');
 const old=more&&more.getAttribute('style');
 const deadline=Date.now()+12000;
 try{
  if(more){more.style.display='';more.style.position='absolute';more.style.visibility='hidden';more.style.pointerEvents='none';}
  for(let n=0;n<12&&Date.now()<deadline;n++){
   const found=new Set(cards().map(id));if(ids.every(x=>found.has(x))||!button||!button.isConnected||button.disabled)break;
   const changed=await new Promise(resolve=>{let timer;const before=cards().length;const obs=new MutationObserver(()=>{if(cards().length>before)finish(true)});function finish(v){obs.disconnect();clearTimeout(timer);resolve(v)}obs.observe(grid,{childList:true});timer=setTimeout(()=>finish(false),Math.min(2500,Math.max(1,deadline-Date.now())));button.click();});if(!changed)break;
  }
  const current=cards(),next=order(current,ids,key,id,sold,all);if(next.some((c,i)=>c!==current[i])){const f=document.createDocumentFragment();next.forEach(c=>f.appendChild(c));grid.appendChild(f);}
 }finally{if(more){if(old===null)more.removeAttribute('style');else more.setAttribute('style',old);}}
};
})(typeof window==='undefined'?globalThis:window);
;(function(root){
const buttons=new WeakMap();
root.fpBuffer=function(grid,more,limit,next){
 const cards=Array.from(grid.querySelectorAll(':scope > .product-card'));
 const buffered=cards.length>limit;
 if(!more||!more.parentNode)return false;
 let state=buttons.get(grid);
 if(buffered){
  if(!state){const wrap=document.createElement('div');wrap.className='item-list-actions';const button=document.createElement('button');button.type='button';button.className='item-list-more';button.textContent='もっと見る';wrap.appendChild(button);more.parentNode.insertBefore(wrap,more);state={wrap,button,display:more.style.display};buttons.set(grid,state);}
  state.button.onclick=next;state.wrap.style.display='';more.style.display='none';cards.slice(limit).forEach(c=>c.style.display='none');
 }else if(state){state.wrap.remove();more.style.display=state.display;buttons.delete(grid);}
 return buffered;
};
})(typeof window==='undefined'?globalThis:window);
