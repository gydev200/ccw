export const ER_MENU=[['home','전체 현황'],['finance','재무·회계·자산 / 업무 현황'],['personnel','인사·노무 / 업무 현황'],['legal','법무 / 업무 현황'],['protection','정보보안 / 업무 현황'],['general','총무 / 업무 현황'],['onboarding','고객사 이지행정'],['assets','자산 관리'],['contracts','계약·원본'],['dispute','송무·분쟁'],['ip','특허·상표'],['privacy','개인정보·위탁'],['procure','구매·구독'],['calendar','운영 일정'],['strategy','경영 의사결정'],['agendas','의사결정 안건'],['direction','목표·방향'],['advisors','외부 검토'],['execution','결정 후 실행'],['information','정보전략관리'],['security','보안관리']] as const;
export const HR_MENU=[['home','인사 업무현황'],['planning','인력계획·조직'],['system','사람·AI 추진체계'],['people','직원·인사기록'],['recruiting','채용·입사'],['talent','인재풀·채용채널'],['brand','채용 브랜딩'],['documents','근로계약·노무 서류'],['gig','긱워커 계약·정산'],['labor','근태·휴가·노무'],['work','직무·업무 운영'],['education','교육·오리엔테이션·시험'],['logs','업무일지·피드백'],['aiusage','업무 AI 사용기록'],['reviews','정기 평가'],['compensation','평가·보상 연결'],['lifecycle','입사부터 퇴사까지'],['relations','직원 고충·노사'],['compliance','법정 의무·안전'],['advisors','이사회·자문단'],['sources','대화·녹음 근거'],['report','인사 보고'],['consult','인사 상담']] as const;
export const FM_MENU=[['control','경리 출근판'],['work','주기별 업무'],['receivables','수금·미수'],['home','재무 업무현황'],['cash','수입·지출 / 출납'],['journal','경리·회계 / 일계표'],['invoices','세금계산서'],['report','일간·월간 재무보고'],['settlement','정산·원가'],['approvals','증빙·승인'],['consult','경리봇 상담']] as const;
export function dssAllowed(member:any){return member?.active===1&&(member.role==='DO'||(['kyunghwa','kimkiyoung'].includes(member.person)&&member.dss===1&&(!member.access||member.access.orgs.includes('DSS'))));}
export function hrManagerAllowed(member:any){return dssAllowed(member)&&(member.role==='DO'||member.person==='kimkiyoung')}
export function dssLabel(tab:string){const [group,id]=tab.split(':');return (group==='ER'?ER_MENU:group==='HR'?HR_MENU:group==='FM'?FM_MENU:[]).find(x=>x[0]===id)?.[1]||tab;}
export function dssMenu(tab:string,member:any){if(!dssAllowed(member))return [];return (tab.startsWith('ER:')?ER_MENU:tab.startsWith('HR:')?HR_MENU:tab.startsWith('FM:')?FM_MENU:[]).filter(([id])=>member.role==='DO'||(tab.startsWith('HR:')&&(member.person==='kimkiyoung'||['home','education','logs','labor'].includes(id)))).map(([id])=>(tab.startsWith('ER:')?'ER:':tab.startsWith('HR:')?'HR:':'FM:')+id);}
export function validDssTab(tab:string,member:any){return dssMenu(tab,member).includes(tab);}

// Keep finance links stable across refreshes; authorization remains in validDssTab.
export function financeTabFromHash(hash:string){
 const match=/^#(?:fm|ccfm)(?:\/([a-z]+))?$/.exec(hash);
 if(!match)return null;
 const section=match[1]||'home';
 return FM_MENU.some(([id])=>id===section)?'FM:'+section:null;
}
export function financeHash(tab:string){
 const section=tab.startsWith('FM:')?tab.slice(3):'';
 return FM_MENU.some(([id])=>id===section)?(section==='home'?'#fm':'#fm/'+section):null;
}

export function strategyTabFromHash(hash:string){const m=/^#dss(?:\/([a-z]+))?$/.exec(hash);if(!m)return null;const id=m[1]||'home';return ER_MENU.some(x=>x[0]===id)?'ER:'+id:null;}
export function strategyHash(tab:string){const id=tab.startsWith('ER:')?tab.slice(3):'';return ER_MENU.some(x=>x[0]===id)?(id==='home'?'#dss':'#dss/'+id):null;}

export type DssNavGroup={label:string;items:string[]};
export function dssDepartment(tab:string){
 if(tab.startsWith('FM:')||['ER:finance','ER:assets'].includes(tab))return 'finance';
 if(tab.startsWith('HR:')||tab==='ER:personnel')return 'personnel';
 if(['ER:legal','ER:contracts','ER:dispute','ER:ip'].includes(tab))return 'legal';
 if(['ER:protection','ER:security','ER:privacy','ER:information'].includes(tab))return 'protection';
 if(['ER:general','ER:procure','ER:calendar'].includes(tab))return 'general';
 return 'home';
}
export function dssSidebar(tab:string,member:any):DssNavGroup[]{
 if(!dssAllowed(member))return [];
 if(member.role!=='DO')return member.person==='kimkiyoung'?[{label:'인사 현황',items:['HR:home','HR:sources','HR:report','HR:consult']},{label:'인력·채용',items:['HR:planning','HR:system','HR:people','HR:recruiting','HR:talent','HR:brand']},{label:'근무·노무',items:['HR:documents','HR:gig','HR:labor','HR:work','HR:lifecycle','HR:relations','HR:compliance']},{label:'교육·평가',items:['HR:education','HR:logs','HR:aiusage','HR:reviews','HR:compensation']},{label:'이사회·자문단',items:['HR:advisors']}]:[{label:'내 인사 업무',items:dssMenu('HR:home',member)}];
 const menus:Record<string,DssNavGroup[]>={
 home:[{label:'전체 현황',items:['ER:home']},{label:'의사결정',items:['ER:strategy','ER:agendas']},{label:'목표·실행',items:['ER:direction','ER:execution']},{label:'외부 검토',items:['ER:advisors']}],
 finance:[{label:'업무 현황',items:['ER:finance']},{label:'경리·출납·승인',items:['FM:control','FM:work','FM:receivables','FM:cash','FM:approvals']},{label:'회계·세금',items:['FM:journal','FM:invoices']},{label:'손익·보고',items:['FM:settlement','FM:report','FM:consult']},{label:'자산 관리',items:['ER:assets']}],
 personnel:[{label:'업무 현황',items:['ER:personnel']},{label:'기록·보고',items:['HR:sources','HR:report','HR:consult']},{label:'인력·채용',items:['HR:planning','HR:system','HR:people','HR:recruiting','HR:talent','HR:brand']},{label:'근무·노무',items:['HR:documents','HR:gig','HR:labor','HR:work','HR:lifecycle','HR:relations','HR:compliance']},{label:'교육·평가·보상',items:['HR:education','HR:logs','HR:aiusage','HR:reviews','HR:compensation']},{label:'이사회·자문단',items:['HR:advisors']}],
 legal:[{label:'업무 현황',items:['ER:legal']},{label:'계약·원본',items:['ER:contracts']},{label:'송무·분쟁',items:['ER:dispute']},{label:'특허·상표',items:['ER:ip']}],
 protection:[{label:'업무 현황',items:['ER:protection']},{label:'권한·보안',items:['ER:security']},{label:'개인정보·위탁',items:['ER:privacy']},{label:'정보 전략',items:['ER:information']}],
 general:[{label:'업무 현황',items:['ER:general']},{label:'구매·구독',items:['ER:procure']},{label:'운영 일정',items:['ER:calendar']}]
 };return menus[dssDepartment(tab)];
}

export function canonicalDssTab(tab:string,member:any){return member?.role==='DO'?(tab==='FM:home'?'ER:finance':tab==='HR:home'?'ER:personnel':tab):tab;}
