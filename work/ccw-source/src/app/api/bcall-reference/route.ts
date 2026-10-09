import {member,fail,HttpError} from '@/lib/server';
import {canRead} from '@/lib/outreach';
import {bcallReference} from '@/lib/bcall-reference';
export async function GET(){try{const m=await member();if(!canRead(m))throw new HttpError(403,'직원 전용 자료입니다.');return new Response(bcallReference,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'"}})}catch(e){return fail(e)}}
