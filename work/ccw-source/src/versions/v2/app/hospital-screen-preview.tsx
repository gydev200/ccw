'use client';
import {useState} from 'react';
import {Building2,UserRound,Wifi,BatteryFull,Signal,FileText,ChevronRight,UsersRound} from 'lucide-react';
import type {HospitalProfile} from '@/lib/v2-hospital-profile';
import catalog from '@/versions/v2/lib/rehabilitation-materials.json';
import styles from './hospital-setup.module.css';
export default function HospitalScreenPreview({name,profile,mode='patient',confirmed=false}:{name:string;profile:HospitalProfile;mode?:'patient'|'staff';confirmed?:boolean}){
 const [service,setService]=useState('');const selected=profile.services.includes(service)?service:profile.services[0];
 return <section className={`${styles.preview} ${mode==='patient'?styles.patientPreview:styles.staffPreview}`} aria-label={mode==='patient'?'통합 환자 화면 미리보기':'병원 직원 화면 미리보기'} style={{'--clinic':profile.color} as React.CSSProperties}>
 {mode==='patient'&&<div className={styles.phoneChrome}><b>9:41</b><span><Signal size={12}/><Wifi size={12}/><BatteryFull size={15}/></span></div>}
 <header className={styles.brand}>{profile.logo?<img src={profile.logo} alt={name+' 로고'}/>:<span className={styles.brandIcon}><Building2 size={21}/></span>}<div><strong>{name}</strong><p>{profile.department||'진료과 미지정'} · {mode==='patient'?'환자 안내':'서비스 관리'}</p></div></header>
 <div className={styles.previewBody}>
 {mode==='patient'&&<><div className={styles.patientIntro}><h3>진료 이후에도,<br/>곁에서 안내할게요.</h3><p>병원에서 준비한 안내를<br/>편하게 확인하세요.</p></div><div className={styles.director}>{profile.photo?<img src={profile.photo} alt={(profile.director||'원장님')+' 사진'}/>:<span className={styles.portrait}><UserRound size={26}/></span>}<div><strong>{profile.director?profile.director+' 원장':'원장님 이름 미등록'}</strong><small>{profile.photo?'담당 의료진':'원장님 사진 미등록'}</small></div></div></>}
 {mode==='staff'&&<div className={styles.staffTitle}><h3>환자 안내 관리</h3><span>{confirmed?'확정 설정':'초안 미리보기'}</span></div>}
 <nav className={styles.services} aria-label="제공 서비스">{profile.services.map(name=><button type="button" key={name} aria-pressed={selected===name} onClick={()=>setService(name)}>{name}</button>)}</nav>
 {!selected?<div className={styles.previewEmpty}><FileText size={24}/><b>아직 선택한 서비스가 없어요</b><p>제공 서비스를 선택하면 이곳에 표시됩니다.</p></div>:mode==='staff'?<><h4>{selected}</h4><div className={styles.staffMenu}><span>대상 환자</span><span>안내 준비</span><span>검수·진행</span><span>처리 이력</span></div><table className={styles.staffTable}><thead><tr><th>환자</th><th>안내 서비스</th><th>진행 상태</th></tr></thead><tbody><tr><td colSpan={3}><UsersRound size={24} style={{margin:'0 auto 12px'}}/><p>EMR 검수 후 환자 목록이 표시됩니다.</p></td></tr></tbody></table></>:<><h4>{selected} · 병원 안내</h4>{profile.materials.length?catalog.materials.filter(m=>profile.materials.includes(m.id)).map(m=><details key={m.id}><summary>{m.name}<ChevronRight size={14}/></summary><p>{m.draft?.['말풍선 원고']||'원고 준비 중'}</p><small>의료진 검수 전 원고 · 적용 조건: {m.conditions}</small></details>):<div className={styles.previewEmpty}><FileText size={24}/><b>안내를 준비하고 있어요</b><p>진료과 소재를 연결하면 이곳에 표시됩니다.</p></div>}</>}
 </div>
 </section>;
}
