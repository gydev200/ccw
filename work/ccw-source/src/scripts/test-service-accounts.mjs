import {test} from 'node:test';
import assert from 'node:assert/strict';
import {transitionAccount} from '../lib/service-accounts.ts';
const pending={id:'test',memberId:'staff',person:'kyunghwa',name:'테스트',service:'naverworks',purpose:'업무',status:'requested',login:'',workspace:'',url:'',note:'',updatedAt:'old',createdAt:'old'};
test('Approval and actual provisioning are distinct states',()=>{
 assert.throws(()=>transitionAccount(pending,'register',{login:'test@example.com',workspace:'회사'}));
 const approved=transitionAccount(pending,'approve',{});assert.equal(approved.status,'approved');assert.equal(approved.login,'');
 assert.throws(()=>transitionAccount(approved,'register',{login:'',workspace:'회사'}));
 const active=transitionAccount(approved,'register',{login:'test@example.com',workspace:'회사',url:'https://example.com',password:'ignored'});
 assert.equal(active.status,'active');assert.equal(active.login,'test@example.com');assert.equal('password' in active,false);
 assert.throws(()=>transitionAccount(active,'approve',{}));
});
test('Rejection and recovery require a recorded reason; credential-bearing URLs are rejected',()=>{
 assert.throws(()=>transitionAccount(pending,'reject',{note:''}));
 assert.equal(transitionAccount(pending,'reject',{note:'기존 계정 사용'}).status,'rejected');
 const approved=transitionAccount(pending,'approve',{});
 for(const url of ['http://example.com','https://user:pass@example.com','javascript:alert(1)'])assert.throws(()=>transitionAccount(approved,'register',{login:'test',workspace:'회사',url}));
 assert.throws(()=>transitionAccount(approved,'reclaim',{note:''}));
 assert.equal(transitionAccount(approved,'reclaim',{note:'워크스페이스 초대 취소 완료'}).status,'reclaimed');
});
