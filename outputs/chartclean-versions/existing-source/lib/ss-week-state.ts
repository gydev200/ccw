export function weekState(d:any):{label:string;detail:string;tone:string}{
 if(!d)return {label:'조회 중',detail:'결과를 확인하고 있습니다.',tone:'pending'};
 const r=d.delivery;
 if(r){const detail=`수신 ${r.delivered??0} · 처리 중 ${r.pending??0} · 실패 ${r.failed??0} · 미발송 ${r.unsent??0}`;
 if(r.delivered>0||r.accepted>0||r.failed>0||r.pending>0)return {label:r.pending?'발송 결과 확인 중':r.failed?'발송 완료 · 실패 포함':r.unsent?'일부 발송':'발송 완료',detail,tone:r.failed?'held':r.pending?'pending':'sent'};}
 if(d.status)return {label:d.status==='result_received'?'발송 요청 완료':d.status==='sending'?'발송 처리 중':'발송 결과 확인 필요',detail:'수신 결과 미확인 · 재발송 전 결과를 확인해 주세요.',tone:'pending'};
 if(d.target===0)return {label:'발송 계획 없음',detail:'해당 날짜 발송 대상 없음',tone:'pending'};
 if(d.ready)return {label:'승인 요망 · 미발송',detail:'검수 통과 · 담당자의 발송 승인을 기다립니다.',tone:'ready'};
 return {label:'미발송 · '+(d.prepared?'검수 확인 필요':'준비 필요'),detail:d.reason||'자료·명단·검수 근거를 확인해 주세요.',tone:'held'};
}
