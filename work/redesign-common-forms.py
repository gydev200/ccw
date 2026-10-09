from pathlib import Path
p=Path(__file__).parent/'ccw-source/src/versions/v2/app/common-hospital-forms.tsx'
s=p.read_text(encoding='utf-8')
s=s.replace('<section className={styles.root}><h2>공통 양식</h2><p>진료과별 환자 화면·병원 대시보드·소재를 관리합니다.</p>', '<section className={styles.root} data-hospital-portal><header className={styles.pageHeader}><div><h2>공통 양식</h2><p>진료과별 화면과 안내 소재를 관리하세요.</p></div></header>')
s=s.replace('<nav className={styles.hospitals} aria-label="진료과 목록">', '<nav className={styles.hospitals} aria-label="진료과 목록"><div className={styles.directoryHeader}><b>진료과</b><span>{DEPARTMENTS.length}</span></div><div className={styles.directoryList}>')
s=s.replace('setSearch(\'\')}}>{d}</button>)}</nav><article>', 'setSearch(\'\')}}><span><b>{d}</b><small>{d===\'재활의학과\'?\'소재 99개\':\'양식 준비 전\'}</small></span></button>)}</div></nav><article className={styles.hospitalMain}><div className={styles.formContent}>')
s=s.replace('</article></div></section>', '</div></article></div></section>')
p.write_text(s,encoding='utf-8')
print('Department library redesigned')
