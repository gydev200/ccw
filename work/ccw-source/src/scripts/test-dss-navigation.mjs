import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dssAllowed,dssMenu,validDssTab,financeTabFromHash,financeHash} from '../lib/dss-navigation.ts';
const owner={active:1,role:'DO',person:'do'};
test('inactive account cannot open HR or finance',()=>{assert.equal(dssAllowed({...owner,active:0}),false);assert.deepEqual(dssMenu('FM:home',{...owner,active:0}),[])});
test('non-DSS staff cannot enter through direct hash',()=>{assert.equal(validDssTab('HR:education',{active:1,role:'STAFF',person:'parttime',dss:0}),false)});
test('DSS staff can open education but not recruiting or finance',()=>{const m={active:1,role:'STAFF',person:'kyunghwa',dss:1};assert.equal(validDssTab('HR:education',m),true);assert.equal(validDssTab('HR:recruiting',m),false);assert.equal(validDssTab('FM:cash',m),false)});
test('owner can open both menu trees; unknown sections cannot mount',()=>{assert.equal(validDssTab('FM:invoices',owner),true);assert.equal(validDssTab('HR:logs',owner),true);assert.equal(validDssTab('FM:send-money',owner),false)});

test('finance links restore every section, including legacy aliases',()=>{
 for(const section of ['home','cash','journal','invoices','report','settlement','approvals','consult']){
  assert.equal(financeTabFromHash(financeHash('FM:'+section)),'FM:'+section);
 }
 assert.equal(financeTabFromHash('#ccfm'),'FM:home');
 assert.equal(financeTabFromHash('#fm/sendmoney'),null);
 assert.equal(financeHash('HR:home'),null);
});

test('management, information and security remain DO-only',()=>{const staff={active:1,role:'STAFF',person:'kyunghwa',dss:1};for(const section of ['home','agendas','direction','advisors','execution','information','security']){assert.equal(validDssTab('ER:'+section,owner),true);assert.equal(validDssTab('ER:'+section,staff),false)}});

test('DSS operations remain owner-only',()=>{for(const section of ['finance','personnel','legal','protection','general','onboarding','strategy']){assert.equal(validDssTab('ER:'+section,owner),true);assert.equal(validDssTab('ER:'+section,{active:1,role:'STAFF',person:'kyunghwa',dss:1}),false);}});

import {dssSidebar,dssDepartment,strategyTabFromHash,strategyHash} from '../lib/dss-navigation.ts';
test('department sidebar is bounded and never repeats department navigation',()=>{for(const tab of ['ER:home','ER:finance','HR:people','ER:legal','ER:protection','ER:general']){const groups=dssSidebar(tab,owner);assert.ok(groups.length<=6);assert.ok(!groups.flatMap(x=>x.items).includes('ER:onboarding'));}assert.equal(dssDepartment('FM:journal'),'finance');assert.equal(dssDepartment('ER:dispute'),'legal');assert.equal(dssDepartment('HR:reviews'),'personnel');});
test('department detail links restore and remain owner-only',()=>{for(const id of ['assets','contracts','dispute','ip','privacy','procure','calendar']){const tab='ER:'+id;assert.equal(strategyTabFromHash(strategyHash(tab)),tab);assert.equal(validDssTab(tab,{active:1,role:'STAFF',person:'kyunghwa',dss:1}),false);}});

import {canonicalDssTab} from '../lib/dss-navigation.ts';
test('every department has exactly one direct overview with no duplicate home',()=>{for(const section of ['finance','personnel','legal','protection','general']){const nav=dssSidebar('ER:'+section,owner);assert.deepEqual(nav[0],{label:'업무 현황',items:['ER:'+section]});assert.ok(!nav.flatMap(g=>g.items).some(t=>['HR:home','FM:home'].includes(t)));}assert.equal(canonicalDssTab('FM:home',owner),'ER:finance');assert.equal(canonicalDssTab('HR:home',owner),'ER:personnel');assert.equal(canonicalDssTab('HR:home',{role:'STAFF'}),'HR:home');});

test('HR manager sees all personnel folders while other staff see only assigned menus',()=>{const manager={active:1,role:'STAFF',person:'kimkiyoung',dss:1};assert.equal(validDssTab('HR:gig',manager),true);assert.equal(validDssTab('HR:aiusage',manager),true);assert.equal(validDssTab('HR:sources',manager),true);assert.equal(validDssTab('HR:gig',{...manager,person:'kyunghwa'}),false);const ids=dssSidebar('ER:personnel',owner).flatMap(g=>g.items);assert.equal(new Set(ids).size,ids.length);assert.ok(ids.includes('HR:gig'));assert.ok(ids.includes('HR:sources'));});
