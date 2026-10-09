import data from '@/lib/manual-data.json';
import {member,json,fail} from '@/lib/server';
import {mayOrg} from '@/lib/policy';
export const dynamic='force-dynamic';
export async function GET(){try{const m=await member();return json({...data,orgs:data.orgs.filter(o=>mayOrg(m,o[0])),steps:data.steps.filter(s=>mayOrg(m,s.org)),intro:m.role==='DO'?data.intro:data.intro.filter(x=>x[0]!=='DSS 접근')});}catch(e){return fail(e)}}
