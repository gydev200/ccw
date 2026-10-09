import {headers} from 'next/headers';
import {workspaceVersion} from './workspace-version';
import { env } from '@/lib/runtime';
import {sessionUser} from './local-auth';
import {defaultAccess} from './work-orders';
import type {Member} from './model';
import {mayRecord} from './policy';
export class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
export const db=()=>{if(!env.DB)throw new HttpError(503,'저장소 연결을 확인하고 있습니다. 다시 시도해 주세요.');return env.DB};
export const bucket=()=>env.FILES;
export function bootstrapOwner(email:string){if(!env.OWNER_EMAIL||email.toLowerCase()!==env.OWNER_EMAIL.toLowerCase())throw new HttpError(403,'이사님 계정만 ERP를 시작할 수 있습니다.');}
export const now=()=>new Date().toISOString();
export async function identity(allowPasswordChange=false){const u=await sessionUser();if(u?.mustChangePassword&&!allowPasswordChange)throw new HttpError(428,'먼저 임시 비밀번호를 변경해 주세요.');if(!u)throw new HttpError(401,'로그인이 필요합니다.');return u}
export async function member(allowPasswordChange=false){const u=await identity(allowPasswordChange);const m=await db().prepare('SELECT * FROM members WHERE id = ? AND active = 1').bind(u.userId).first<Member>();if(!m)throw new HttpError(403,'이사님의 계정 연결이 필요합니다.');const credentialIndex=await db().prepare('SELECT value FROM settings WHERE key=?').bind('credential-member:'+m.id).first<any>();const version=workspaceVersion(credentialIndex?.value||'',m.person);if(version==='v2'&&!allowPasswordChange){const method=(await headers()).get('x-ccw-method');if(method&&method!=='GET'&&method!=='HEAD')throw new HttpError(403,'버전 2 검수 화면입니다. 운영 데이터 변경은 DO 화면에서 진행해 주세요.');}const access=await db().prepare('SELECT value FROM settings WHERE key=?').bind('staff-access:'+m.person).first<any>();return {...m,role:version==='v2'&&!allowPasswordChange?'DO':m.role,workspaceVersion:version,access:access?JSON.parse(access.value):defaultAccess(m.person),mustChangePassword:u.mustChangePassword||false}}
export function owner(m:Member){if(m.role!=='DO')throw new HttpError(403,'이사님만 처리할 수 있습니다.')}
export function origin(req:Request){const value=req.headers.get('origin');if(!value||value!==new URL(req.url).origin)throw new HttpError(403,'이 화면에서 다시 시도해 주세요.');}
export async function record(id:number,m:Member){const r=await db().prepare('SELECT * FROM records WHERE id = ?').bind(id).first<any>();if(!r||!mayRecord(m,r))throw new HttpError(404,'업무를 찾을 수 없거나 접근 권한이 없습니다.');r.data=JSON.parse(r.data);return r}
export async function updateRecord(r:any,data:any,m:Member,action:string,detail:any={}){const ts=now();const out=await db().batch([
 db().prepare('UPDATE records SET data = ?, org = ?, assignee = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?').bind(JSON.stringify(data),data.org||r.org,data.assignee||r.assignee,ts,r.id,r.version),
 db().prepare('INSERT INTO events (record_id,org,actor,action,data,created_at) SELECT ?,?,?,?,?,? WHERE changes() > 0').bind(r.id,data.org||r.org,m.id,action,JSON.stringify(detail),ts)
]);if(!out[0].meta.changes)throw new HttpError(409,'다른 변경이 먼저 저장됐습니다. 새로고침 후 다시 확인해 주세요.');return {...r,data,version:r.version+1,updated_at:ts,org:data.org||r.org,assignee:data.assignee||r.assignee}}
export async function createRecord(kind:string,org:string,assignee:string,data:any,m:Member,dedup?:string){const ts=now();const result=await db().batch([
 db().prepare('INSERT INTO records (kind,org,assignee,data,dedup,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(kind,org,assignee,JSON.stringify(data),dedup||null,ts,ts),
 db().prepare('INSERT INTO events (record_id,org,actor,action,data,created_at) VALUES (last_insert_rowid(),?,?,?,?,?)').bind(org,m.id,'등록',JSON.stringify({kind,title:data.title||data.name}),ts)
]);return Number(result[0].meta.last_row_id)}
export function json(data:any,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
export function fail(e:unknown){return json({error:e instanceof Error?e.message:'저장하지 못했습니다.'},e instanceof HttpError?e.status:400)}
