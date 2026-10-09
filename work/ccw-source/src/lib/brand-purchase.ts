export const BADGE_PURCHASE_ID='CC-BRAND-ID-20261004-01';
export const BADGE_COMPARISON_REF='/api/brand-purchase-brief';
export type Quote={vendor:string;status:'문의대기'|'공개가격 참고'|'정식 견적 수취';supply:number;vat:number;shipping:number;quoteRef:string;receivedDate:string;validUntil:string;publicReference:string};
export type BrandPurchase={id:string;design:string;spec:string;reorderVersion:string;quotes:Quote[];recommended:number|null;order?:{ref:string;date:string};invoice?:{number:string;ref:string;date:string;amount:number;differenceReason:string};bank?:{accountVerificationRef:string;transferRef:string;transferDate:string;amount:number;invoiceAfterReason:string;invoiceDueDate:string};receipt?:{date:string;inspectionRef:string}};
export const blankQuote=():Quote=>({vendor:'',status:'문의대기',supply:0,vat:0,shipping:0,quoteRef:'',receivedDate:'',validUntil:'',publicReference:''});
export const blankBrandPurchase=():BrandPurchase=>({id:BADGE_PURCHASE_ID,design:'PVC 직원 사진 중심 세로/가로 시안 제작 중 · 실제 직원 사진 미제공',spec:'흰색 20mm × 900mm 폴리에스터 줄 · ChartClean 로고·원형 H01 반복 · PVC 직원증 · 50개는 예산 비교안이며 실제 수량 미승인',reorderVersion:'초판',quotes:[{...blankQuote(),vendor:'마젠타카드',status:'공개가격 참고',publicReference:'20mm 50개 170,000원(VAT 포함) 공개가격 · 카드·케이스·배송비 미정 · 우선 견적 요청 후보'},{...blankQuote(),vendor:'포인트씨엠',publicReference:'20mm 상품 공개 · 전화 견적·수주 가능 여부 확인 대기'},{...blankQuote(),vendor:'디지털피아',publicReference:'기본 MOQ 100개 · 20mm 풀컬러 제공 가능 여부 확인 대기'}],recommended:null});
export const quoteTotal=(quote:Quote)=>quote.supply+quote.vat+quote.shipping;
const validMoney=(value:number)=>Number.isSafeInteger(value)&&value>=0&&value<=1_000_000_000;
const validDay=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export function validateBrandDraft(p:BrandPurchase){
 if(p.id!==BADGE_PURCHASE_ID)throw Error('구매건 ID를 확인해 주세요.');
 if(!p.design.trim()||!p.spec.trim()||!p.reorderVersion.trim())throw Error('브랜드 디자인·제작 규격·재주문 버전을 입력해 주세요.');
 if(p.quotes.length!==3)throw Error('비교업체 3곳을 등록해 주세요.');
 p.quotes.forEach((q,index)=>{if(!['문의대기','공개가격 참고','정식 견적 수취'].includes(q.status))throw Error(`${index+1}번 업체 상태를 확인해 주세요.`);if(![q.supply,q.vat,q.shipping].every(validMoney))throw Error(`${index+1}번 업체 금액을 확인해 주세요.`);if(q.status==='정식 견적 수취'&&(!q.vendor.trim()||!q.quoteRef.trim()||!validDay(q.receivedDate)))throw Error(`${index+1}번 업체의 정식 견적서·수취일을 확인해 주세요.`);if(q.validUntil&&!validDay(q.validUntil))throw Error(`${index+1}번 견적 유효기간을 확인해 주세요.`)});
}
export function validateBrandSubmission(p:BrandPurchase){
 validateBrandDraft(p);
 if(p.quotes.some(q=>q.status!=='정식 견적 수취'))throw Error('3곳의 정식 견적서를 모두 받기 전에는 결재를 올릴 수 없습니다. 공개가격 조사표는 견적서가 아닙니다.');
 const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 if(p.quotes.some(q=>q.validUntil&&q.validUntil<today))throw Error('유효기간이 지난 견적서는 재확인해 주세요.');
 if(p.recommended===null||!Number.isInteger(p.recommended)||p.recommended<0||p.recommended>2)throw Error('추천 업체 1곳을 선택해 주세요.');
 if(quoteTotal(p.quotes[p.recommended])<=0)throw Error('추천 견적의 공급가·부가세·배송비를 확인해 주세요.');
 return {vendor:p.quotes[p.recommended].vendor,amount:quoteTotal(p.quotes[p.recommended])};
}
export function canRecordTransfer(p:BrandPurchase){
 if(!p.order)throw Error('승인 후 발주 근거를 먼저 기록해 주세요.');
 if(!p.bank?.accountVerificationRef||!p.bank.transferRef||!validDay(p.bank.transferDate))throw Error('업체 계좌 등록 확인 근거·이체번호·이체일이 필요합니다.');
 if(!validMoney(p.bank.amount)||p.bank.amount<=0)throw Error('법인 이체 금액을 확인해 주세요.');
 if(!p.invoice&&(!p.bank.invoiceAfterReason.trim()||!validDay(p.bank.invoiceDueDate)))throw Error('세금계산서가 없으면 후수취 거래조건·수취기한이 필요합니다.');
}
export function canClosePurchase(p:BrandPurchase){
 if(!p.order||!p.bank||!p.invoice||!p.receipt)throw Error('발주·계산서·이체·수령 검수가 모두 확인돼야 마감할 수 있습니다.');
}
