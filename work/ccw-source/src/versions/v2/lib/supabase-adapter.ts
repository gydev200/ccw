import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const TABLES = new Set(['settings','members','records','events','files','times','drafts','control_entries','hr_entries','academy_answer_backups']);
const SERIAL_TABLES = new Set(['records','events','times','control_entries','hr_entries','academy_answer_backups']);
export type QueryResult<T = Record<string, unknown>> = {results:T[];success:boolean;meta:{changes:number;last_row_id:number;duration:number}};

// SQL is authored in the application. Only bound values come from visitors.
// Keep literals separate so quotes, SQL-looking text and JSON cannot become SQL.
export function postgresStatement(sql:string, args:unknown[] = []) {
  const tokens = sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`|[A-Za-z_][A-Za-z_0-9]*|\?|[^A-Za-z_'"`?]+/g) || [];
  let at=0;
  let ignored=false;
  const converted=tokens.map(token=>{
    if(token==='?') {
      if(at>=args.length)throw new Error('저장 요청의 값 개수가 맞지 않습니다.');
      const value=args[at++];
      if(value===null||value===undefined)return 'NULL';
      if(typeof value==='number'&&!Number.isFinite(value))throw new Error('숫자 값을 확인해 주세요.');
      if(!['string','number','boolean'].includes(typeof value))throw new Error('저장할 값의 형식을 확인해 주세요.');
      return "'"+String(typeof value==='boolean'?Number(value):value).replaceAll("'","''")+"'";
    }
    if(token.startsWith("'"))return token;
    if(token.startsWith('`'))return '"'+token.slice(1,-1)+'"';
    if(/^[A-Za-z_]/.test(token)) {
      const lower=token.toLowerCase();
      if(lower==='json_extract')return 'chartclean_erp.ccw_json_extract';
      if(lower==='json_set')return 'chartclean_erp.ccw_json_set';
      if(lower==='json_object')return 'chartclean_erp.ccw_json_object';
      if(lower==='json_group_array')return 'chartclean_erp.ccw_json_group_array';
      if(lower==='changes')return 'chartclean_erp.ccw_changes';
      if(lower==='last_insert_rowid')return 'chartclean_erp.ccw_last_id';
      if(lower==='integer')return 'bigint';
    }
    return token;
  }).join('');
  if(at!==args.length)throw new Error('저장 요청의 값 개수가 맞지 않습니다.');
  let out=converted.trim().replace(/;\s*$/,'');
  if(!/^(SELECT|INSERT|UPDATE|DELETE)\b/i.test(out))throw new Error('지원하지 않는 저장 요청입니다.');
  const unquoted=out.replace(/'(?:''|[^'])*'/g,"''");
  if(/[;]|--|\/\*|\b(?:DROP|ALTER|TRUNCATE|GRANT|REVOKE|COPY|pg_|information_schema)\b/i.test(unquoted))throw new Error('허용되지 않은 저장 요청입니다.');
  out=out.replace(/INSERT\s+OR\s+IGNORE\s+INTO\b/i,()=>{ignored=true;return 'INSERT INTO';});
  // Only the fixed outreach_* pattern exists in the source application.
  out=out.replace(/\bGLOB\s+'outreach_\*'/gi,"LIKE 'outreach\\_%' ESCAPE '\\'");
  if(ignored&&!/\bON\s+CONFLICT\b/i.test(out))out+=' ON CONFLICT DO NOTHING';
  const inserted=out.match(/^INSERT\s+INTO\s+([a-z_]+)/i)?.[1];
  if(inserted==='settings'&&/ON\s+CONFLICT[\s\S]+DO\s+UPDATE/i.test(out))out=out.replace(/CAST\(value\s+AS\b/gi,'CAST(settings.value AS');
  if(inserted&&!TABLES.has(inserted))throw new Error('저장 공간을 확인해 주세요.');
  const mutation=/^(INSERT|UPDATE|DELETE)\b/i.test(out);
  const hasReturning=/\bRETURNING\b/i.test(out.replace(/'(?:''|[^'])*'/g,"''"));
  const autoId=!!inserted&&SERIAL_TABLES.has(inserted);
  if(mutation&&!hasReturning)out+=' RETURNING '+(autoId?'id':'1 AS ccw_changed');
  return {sql:out,mutation,autoId};
}

let client:SupabaseClient|undefined;
export function supabaseAdmin(){
  if(!client){
    const url=process.env.SUPABASE_URL;
    const secret=process.env.SUPABASE_SECRET_KEY;
    if(!url||!secret)throw new Error('자료 저장소 연결이 아직 준비되지 않았습니다.');
    client=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  }
  return client;
}

export class PreparedQuery {
  constructor(readonly sql:string,readonly args:unknown[]=[]){ }
  bind(...args:unknown[]){return new PreparedQuery(this.sql,args);}
  async all<T=Record<string,unknown>>(){return (await database.batch([this]))[0] as QueryResult<T>;}
  async first<T=Record<string,unknown>>(column?:string):Promise<T|null>{const rows=(await this.all<T>()).results;const row=rows[0];return row?(column?(row as any)[column]:row):null;}
  async run<T=Record<string,unknown>>(){return this.all<T>();}
  async raw<T=unknown[]>():Promise<T[]>{return (await this.all()).results.map(row=>Object.values(row) as T);}
}

export const database={
  prepare(sql:string){return new PreparedQuery(sql);},
  async batch(queries:PreparedQuery[]):Promise<QueryResult[]> {
    const statements=queries.map(query=>postgresStatement(query.sql,query.args));
    const {data,error}=await supabaseAdmin().rpc('chartclean_erp_batch',{statements});
    if(error){console.error('ChartClean storage error',error.code);throw new Error('자료를 저장하지 못했습니다. 저장소 연결을 확인해 주세요.');}
    return data as QueryResult[];
  }
};

function filesBucket(){return supabaseAdmin().storage.from(process.env.SUPABASE_FILES_BUCKET||'chartclean-works-private');}
export const privateFiles={
  async get(id:string){
    const {data,error}=await filesBucket().download(id);
    if(error){if((error as any).status===404||(error as any).statusCode==='404'||error.message==='Object not found')return null;throw new Error('첨부 자료를 열지 못했습니다.');}
    return data?{body:data.stream(),arrayBuffer:()=>data.arrayBuffer(),text:()=>data.text(),size:data.size,httpMetadata:{contentType:data.type}}:null;
  },
  async put(id:string,body:ReadableStream|Uint8Array|ArrayBuffer|string,options?:{httpMetadata?:{contentType?:string}}){
    const bytes=body instanceof ReadableStream?await new Response(body).arrayBuffer():body;
    const {error}=await filesBucket().upload(id,bytes,{upsert:false,contentType:options?.httpMetadata?.contentType||'application/octet-stream'});
    if(error)throw new Error('첨부 자료를 저장하지 못했습니다.');
    return {key:id};
  },
  async delete(ids:string|string[]){const {error}=await filesBucket().remove(Array.isArray(ids)?ids:[ids]);if(error)throw new Error('첨부 자료를 정리하지 못했습니다.');}
};
