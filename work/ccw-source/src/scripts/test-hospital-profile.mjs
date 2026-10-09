import test from 'node:test';
import assert from 'node:assert/strict';
import {blankProfile,validateProfile} from '../lib/v2-hospital-profile.ts';
const ids=['A01-1'];
test('profiles validate services, department materials and image sources',()=>{
 const p=blankProfile();assert.deepEqual(validateProfile(p,ids).services,[]);
 assert.throws(()=>validateProfile({...p,services:['CTI']},ids));
 assert.throws(()=>validateProfile({...p,services:['진료 후 케어','진료 후 케어']},ids));
 assert.throws(()=>validateProfile({...p,photo:'javascript:alert(1)'},ids));
 assert.throws(()=>validateProfile({...p,logo:'https://user:password@example.com/logo.png'},ids));
 assert.throws(()=>validateProfile({...p,materials:['A01-1']},ids));
 assert.throws(()=>validateProfile({...p,department:'재활의학과',materials:['unknown']},ids));
 assert.deepEqual(validateProfile({...p,department:'재활의학과',materials:ids},ids).materials,ids);
});
test('confirmation requires all hospital identity fields and evidenced preparation',()=>{
 const p=blankProfile();assert.throws(()=>validateProfile(p,ids,true));
 assert.throws(()=>validateProfile({...p,steps:p.steps.map(s=>({...s,complete:true}))},ids));
 const ready={...p,matchingReviewed:true,previewReviewed:true,director:'검수 원장',photo:'https://example.com/photo.jpg',logo:'https://example.com/logo.png',department:'재활의학과',services:['진료 후 케어'],steps:p.steps.map(s=>({...s,complete:true,evidence:'담당 확인 근거'}))};
 assert.equal(validateProfile(ready,ids,true).services.length,1);
 assert.throws(()=>validateProfile({...ready,matchingReviewed:false},ids,true));
 assert.throws(()=>validateProfile({...ready,previewReviewed:false},ids,true));
 assert.throws(()=>validateProfile({...ready,steps:ready.steps.slice(1)},ids,true));
 assert.throws(()=>validateProfile({...ready,steps:ready.steps.map((s,i)=>i===0?{...s,complete:false}:s)},ids,true));
});
