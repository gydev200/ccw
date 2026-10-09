import {MapPinned,Building2} from 'lucide-react';
export default function SituationRoom({view}:{view:'map'|'customers'}){
 return <section className="situation-room"><header><h1>{view==='map'?'지도':'고객사별 현황'}</h1><p>{view==='map'?'고객사 위치와 지역별 현황을 확인할 공간입니다.':'고객사별 진행 상황과 담당자를 한눈에 확인할 공간입니다.'}</p></header>
 {view==='map'?<div className="situation-map-placeholder"><MapPinned size={40} strokeWidth={1.5}/><h2>지도 표시 영역</h2><p>지도와 고객사 위치는 추후 연결됩니다.</p></div>:<div className="situation-board"><div className="situation-table-scroll"><table><thead><tr>{['고객사','지역','담당자','진행 단계','현재 상황','최근 업데이트'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody/></table></div><div className="situation-board-empty"><Building2 size={32} strokeWidth={1.5}/><h2>고객사 현황 표시 영역</h2><p>고객사 데이터는 아직 연결되지 않았습니다.</p></div></div>}
 </section>;
}
