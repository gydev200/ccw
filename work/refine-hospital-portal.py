from pathlib import Path
root=Path(__file__).parent/'ccw-source/src'
p=root/'lib/v2-hospital-access.ts'
s=p.read_text(encoding='utf-8').replace("AND json_extract(data,'$.setupGroup') IS NOT NULL", "AND (json_extract(data,'$.setupGroup') IS NOT NULL OR json_extract(data,'$.name')='테스트 병원')")
p.write_text(s,encoding='utf-8')
p=root/'app/api/v2/hospital-profile/route.ts'
s=p.read_text(encoding='utf-8')
old="return json({profiles:Object.fromEntries"
new="const extra=await db().prepare(\"SELECT id,json_extract(data,'$.name') AS name FROM records WHERE kind='customer' AND json_extract(data,'$.setupGroup') IS NULL AND json_extract(data,'$.name')='테스트 병원'\").all<{id:number,name:string}>();return json({extraHospitals:extra.results.map(h=>({...h,alias:h.name,category:'테스트',reference:{}})),profiles:Object.fromEntries"
assert old in s
p.write_text(s.replace(old,new),encoding='utf-8')
p=root/'versions/v2/app/hospital-setup-portal.tsx'
s=p.read_text(encoding='utf-8').replace('setDirectory(d.hospitals);','setDirectory([...d.hospitals,...(c.extraHospitals||[])]);')
s=s.replace('<select value={model.department}', '<select aria-label="진료과" value={model.department}')
p.write_text(s,encoding='utf-8')
p=root/'versions/v2/app/workspace.tsx'
s=p.read_text(encoding='utf-8')
old="'이메일','계정·설정','공지·일정','지도','고객사별 현황'].includes(tab)"
assert old in s
s=s.replace(old,"'이메일','계정·설정','공지·일정','지도','고객사별 현황','병원 정보','세팅','운영','공통 양식'].includes(tab)")
p.write_text(s,encoding='utf-8')
print('Test hospital retained and duplicate heading removed')
