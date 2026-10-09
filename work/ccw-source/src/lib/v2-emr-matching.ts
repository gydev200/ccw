import ExcelJS from 'exceljs';
import {Readable} from 'node:stream';
import catalog from '@/versions/v2/lib/rehabilitation-materials.json';
export type ListKind='diagnosis'|'fee';
export type ListEntry={code:string;name:string;source:string};
const clean=(v:string)=>v.normalize('NFKC').toLowerCase().replace(/[\s().·_\-]/g,'');
const code=(v:string)=>v.toUpperCase().replace(/[^A-Z0-9]/g,'');
export function compareEntries(entries:ListEntry[],kind:ListKind,department:string){
 const library=department===catalog.department?catalog.materials:[];
 return entries.map(entry=>{const candidates=library.filter(m=>kind==='diagnosis'&&entry.code?String(m.codes||'').toUpperCase().split(/[,;\s\/]+/).filter(Boolean).some(c=>code(c)===code(entry.code)):!!entry.name&&clean(entry.name)===clean(m.name));return {...entry,candidates:candidates.map(m=>({id:m.id,name:m.name})),basis:candidates.length?(kind==='diagnosis'&&entry.code?'상병 코드 일치':'명칭 일치'):'공통 소재 미매칭',review:'담당자 검토 필요'};});
}
export async function parseList(bytes:Uint8Array,filename:string,kind:ListKind):Promise<ListEntry[]>{
 const workbook=new ExcelJS.Workbook();
 if(/\.xlsx$/i.test(filename)){
  const b=Buffer.from(bytes);let total=0,found=0;for(let i=0;i+46<b.length;i++){if(b.readUInt32LE(i)!==0x02014b50)continue;found++;total+=b.readUInt32LE(i+24);if(total>32*1024*1024||found>2000)throw Error('압축 해제 용량이 큰 파일입니다. 상병·수가 리스트만 별도 저장해 주세요.');i+=45+b.readUInt16LE(i+28)+b.readUInt16LE(i+30)+b.readUInt16LE(i+32);}if(!found)throw Error('정상적인 XLSX 파일을 선택해 주세요.');
  await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
 }else if(/\.csv$/i.test(filename)){
  let text=new TextDecoder('utf-8',{fatal:false}).decode(bytes);if(text.includes('\uFFFD'))text=new TextDecoder('euc-kr').decode(bytes);await workbook.csv.read(Readable.from([text]));
 }else throw Error('자동 비교는 XLSX·CSV를 지원합니다. XLS는 XLSX로 저장해 주세요.');
 const entries:ListEntry[]=[];let recognized=false;
 for(const sheet of workbook.worksheets){let headerRow=0,codeCol=0,nameCol=0;
  for(let r=1;r<=Math.min(sheet.rowCount,15);r++){let ccol=0,ncol=0;sheet.getRow(r).eachCell((cell,col)=>{const h=clean(cell.text);if(/환자명|주민등록|차트번호|등록번호/.test(h))throw Error('환자 자료 대신 상병·수가 기준 리스트만 올려 주세요.');if((kind==='diagnosis'?/^(상병|진단|질병|kcd|icd)?(코드|code)$/:/^(수가|행위|청구|보험|edi)?(코드|code)$/).test(h))ccol=col;if((kind==='diagnosis'?/^(상병|진단|질병)?(명|명칭|이름|name)$/:/^(수가|행위|청구|항목)?(명|명칭|이름|name)$/).test(h))ncol=col;});if(ccol||ncol){headerRow=r;codeCol=ccol;nameCol=ncol;recognized=true;break;}}
  if(!headerRow)continue;if(sheet.rowCount-headerRow>5000)throw Error('리스트는 시트당 5,000행 이하로 나누어 주세요.');
  for(let r=headerRow+1;r<=sheet.rowCount;r++){const c=codeCol?sheet.getRow(r).getCell(codeCol).text.trim().slice(0,80):'',n=nameCol?sheet.getRow(r).getCell(nameCol).text.trim().slice(0,200):'';if(c||n)entries.push({code:c,name:n,source:sheet.name+':'+r});if(entries.length>5000)throw Error('리스트는 총 5,000항목 이하로 나누어 주세요.');}
 }
 if(!recognized||!entries.length)throw Error(kind==='diagnosis'?'상병코드·상병명 열이 있는 리스트를 올려 주세요.':'수가코드·수가명 열이 있는 리스트를 올려 주세요.');
 return Array.from(new Map(entries.map(e=>[e.code+'\0'+e.name,e])).values());
}
