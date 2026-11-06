import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import PuttingPractice from "../src/components/putting-practice";

test('putting UI starts the configured plan, records and undoes putts, resumes, and completes',async()=>{
  const page=new JSDOM('<div id="root"></div>',{url:'http://localhost/putting-practice'});
  const previous=new Map<string,PropertyDescriptor|undefined>();
  let stored:any[]=[];
  for(const [key,value] of Object.entries({window:page.window,self:page.window,document:page.window.document,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(url:string,options?:RequestInit)=>{
    if(url==='/api/auth') return Response.json({canEdit:true});
    if(!options?.method) return Response.json(stored);
    const body=JSON.parse(String(options.body));
    let session;
    if(options.method==='POST') session={id:'fixture',createdAt:new Date().toISOString(),completedAt:null,revision:0,rounds:body.map((r:any)=>({...r,results:[]}))};
    else session={...stored[0],rounds:body.rounds,revision:body.revision+1,completedAt:body.rounds.every((r:any)=>r.results.length===r.attempts)?new Date().toISOString():null};
    stored=[session];return Response.json(session);
  }})) {previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
  const {createRoot}=await import('react-dom/client');
  const root=createRoot(page.window.document.getElementById('root')!);
  async function click(text:string) {const button=Array.from(page.window.document.querySelectorAll('button')).find(b=>b.textContent===text);assert.ok(button,`button ${text}`);await act(async()=>{button.click();});}
  try {
    await act(async()=>{root.render(createElement(PuttingPractice));});
    await click('New practice');
    await click('Start practice');
    assert.equal(stored[0].rounds.length,3);
    assert.equal(stored[0].rounds[0].attempts,30);
    assert.deepEqual(stored[0].rounds.map((r:any)=>[r.distance,r.attempts]),[[10,30],[15,30],[20,30]]);
    assert.equal(page.window.document.querySelector('nav')?.lastElementChild?.textContent?.trim(),'Putting Practice');
    await click('Make ✓');await click('Miss ✕');
    assert.deepEqual(stored[0].rounds[0].results,[true,false]);
    await click('Undo last putt');assert.deepEqual(stored[0].rounds[0].results,[true]);
    await click('Back to overview');await click('Resume');
    assert.match(page.window.document.body.textContent!,/Putt 2 of 30/);
    for(let i=1;i<90;i++) await click(i%2?'Miss ✕':'Make ✓');
    assert.ok(stored[0].completedAt);
    assert.match(page.window.document.body.textContent!,/Practice complete/);
    assert.equal(page.window.document.querySelectorAll('.practice-counter').length,0);
    assert.match(page.window.document.body.textContent!,/Completed practices1/);
  } finally {await act(async()=>root.unmount());page.window.close();for(const [key,descriptor] of previous) {if(descriptor) Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
});
