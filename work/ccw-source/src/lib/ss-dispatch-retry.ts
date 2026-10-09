// Only a known pre-provider quota rejection can be retried after a fresh review.
export function quotaRetryAllowed(result:any):boolean {
 return result?.status==='held' && Array.isArray(result.responses) && result.responses.length===1 && result.responses.every((r:any)=>r.ok===false && typeof r.data?.error==='string' && /^이 병원의 하루 발송 상한\(\d+건\)을 채웠습니다\. 내일 이어서 보냅니다\.$/.test(r.data.error) && ['sent','tried','failed','blocked'].every(k=>r.data[k]===undefined||r.data[k]===0));
}
