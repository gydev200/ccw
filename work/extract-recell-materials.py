from pathlib import Path
import json
import openpyxl

root = Path('C:/Users/user/Documents/Codex/2026-10-02/service-01-aftercare/outputs')
inventory = root / 'material-inventory-20261007/연세리셀_메시지소재_AB분류_전체대조_검사포함_v5.xlsx'
copybook = root / 'patient-bubble-copy-20261008/연세리셀_99개소재_원장말풍선_원고.xlsx'

def records(sheet, first_header):
    values = list(sheet.values)
    index = next(i for i, row in enumerate(values) if row[0] == first_header)
    headers = values[index]
    return [dict(zip(headers, row)) for row in values[index + 1:] if row[0]]

book = openpyxl.load_workbook(inventory, data_only=True)
bubbles = openpyxl.load_workbook(copybook, data_only=True)
drafts = {r['제작 ID']: r for r in records(bubbles['소재별 말풍선'], '제작 ID')}
materials = []
for row in records(book['제작 소재'], '제작 ID'):
    if row.get('제작수') != 1:
        continue
    key = row['제작 ID']
    materials.append({
        'id': key, 'group': row.get('상위 묶음'), 'type': row.get('유형'),
        'name': row.get('환자용 소재 이름'), 'codes': row.get('선택 코드'),
        'scope': row.get('콘텐츠 범위'), 'conditions': row.get('선택 조건·주의점'),
        'classificationStatus': row.get('분류 상태'), 'imageCount': row.get('이미지 장수'),
        'guideItems': row.get('안내 항목 (한 줄 = 한 장)'),
        'priority': row.get('우선순위 번호'), 'pendingReason': row.get('안내 항목 미정 사유'),
        'draft': drafts.get(key),
    })
assert len(materials) == 99, f'Expected 99 materials, got {len(materials)}'
assert len({m['id'] for m in materials}) == len(materials)
output = {
    'department': '재활의학과', 'sourceHospital': '연세리셀재활의학과의원',
    'inventorySource': inventory.name, 'draftSource': copybook.name,
    'status': 'import-ready-not-deployed',
    'patientScreen': None, 'hospitalDashboard': None,
    'materials': materials,
    'sharedDrafts': records(bubbles['공통 원고'], '공유 세트 ID'),
}
target = Path('outputs/chartclean-versions/rehabilitation-materials.json')
target.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'materials':len(materials), 'matchedDrafts':sum(m['draft'] is not None for m in materials), 'file':str(target)}, ensure_ascii=False))
