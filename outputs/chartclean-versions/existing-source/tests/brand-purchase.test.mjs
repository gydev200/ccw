import test from 'node:test';
import assert from 'node:assert/strict';
import {blankBrandPurchase,validateBrandDraft,validateBrandSubmission,canRecordTransfer,canClosePurchase} from '../lib/brand-purchase.ts';

test('공개가격 비교표는 정식 견적 3건으로 처리하지 않는다',()=>{
 const purchase=blankBrandPurchase();
 assert.doesNotThrow(()=>validateBrandDraft(purchase));
 assert.equal(purchase.quotes[0].vendor,'마젠타카드');
 assert.equal(purchase.quotes[0].supply,0);
 assert.throws(()=>validateBrandSubmission(purchase),/정식 견적서/);
});

test('승인 전·계좌 확인 전 이체 및 계산서 없는 마감을 막는다',()=>{
 const purchase=blankBrandPurchase();
 assert.throws(()=>canRecordTransfer(purchase),/발주/);
 purchase.order={ref:'발주서 1',date:'2026-10-05'};
 purchase.bank={accountVerificationRef:'',transferRef:'T1',transferDate:'2026-10-05',amount:170000,invoiceAfterReason:'선입금 조건',invoiceDueDate:'2026-10-10'};
 assert.throws(()=>canRecordTransfer(purchase),/계좌/);
 purchase.bank.accountVerificationRef='법인 계좌 대조 1';
 assert.doesNotThrow(()=>canRecordTransfer(purchase));
 purchase.receipt={date:'2026-10-06',inspectionRef:'검수 1'};
 assert.throws(()=>canClosePurchase(purchase),/계산서/);
});

test('3곳의 실제 견적과 추천 1곳이 있어야 승인액을 계산한다',()=>{
 const purchase=blankBrandPurchase();
 purchase.quotes=purchase.quotes.map((quote,index)=>({...quote,status:'정식 견적 수취',quoteRef:`견적-${index+1}`,receivedDate:'2026-10-05',supply:100000+index*10000,vat:10000+index*1000,shipping:5000}));
 assert.throws(()=>validateBrandSubmission(purchase),/추천 업체/);
 purchase.recommended=0;
 assert.deepEqual(validateBrandSubmission(purchase),{vendor:'마젠타카드',amount:115000});
});
