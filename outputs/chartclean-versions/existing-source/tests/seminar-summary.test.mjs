import test from 'node:test';
import assert from 'node:assert/strict';
import {seminarSummary} from '../lib/seminar-summary.ts';

test('같은 병원의 같은 거래는 두 회차에 기록돼도 한 번만 합산한다',()=>{
 const rows=[
  {created_at:'2026-10-01',data:{week:'1',hospitalId:'H-1',application:'예',attendance:'예',paymentAmount:'2000000',paymentRef:'TX-1',paymentEvidence:'은행 확인 1',paidAt:'2026-10-01'}},
  {created_at:'2026-10-02',data:{week:'2',hospitalId:'h-1',application:'예',paymentAmount:'2000000',paymentRef:'TX-1',paymentEvidence:'은행 확인 1',paidAt:'2026-10-01'}},
  {created_at:'2026-10-03',data:{week:'2',hospitalId:'H-1',paymentAmount:'1000000',paymentRef:'TX-2',paymentEvidence:'은행 확인 2',paidAt:'2026-10-03'}},
 ];
 const result=seminarSummary(rows);
 assert.equal(result.paid,3000000);
 assert.equal(result.week1.paid,2000000);
 assert.equal(result.week2.paid,1000000);
 assert.equal(result.week1.application,1);
 assert.equal(result.week2.application,1);
});

test('근거가 없거나 10월 밖 입금은 목표 합계에서 제외한다',()=>{
 const result=seminarSummary([
  {data:{week:'1',hospitalId:'H-1',paymentAmount:'2000000',paymentRef:'TX-1',paidAt:'2026-10-01'}},
  {data:{week:'1',hospitalId:'H-1',paymentAmount:'3000000',paymentRef:'TX-2',paymentEvidence:'은행 확인',paidAt:'2026-11-01'}},
 ]);
 assert.equal(result.paid,0);
});
