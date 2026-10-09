import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {postgresStatement} from '../lib/supabase-adapter';
const pg=new PGlite();
await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
await pg.exec(readFileSync(new URL('../supabase/migrations/20261008_chartclean.sql',import.meta.url),'utf8'));
async function batch(entries:[string,unknown[]?][]){const statements=entries.map(([q,args])=>postgresStatement(q,args));const r=await pg.query<{result:any}>('SELECT public.chartclean_erp_batch($1::jsonb) result',[JSON.stringify(statements)]);return r.rows[0].result;}
const at=new Date().toISOString();
const injected="O'Brien'; DROP TABLE members; -- ?";
const inserted=await batch([
 ['INSERT INTO records(kind,org,assignee,data,dedup,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',['task','DO','do',JSON.stringify({title:injected,revision:1}),'test',at,at]],
 ['INSERT INTO events(record_id,org,actor,action,data,created_at) VALUES(last_insert_rowid(),?,?,?,?,?)',['DO','test','created','{}',at]],
 ['SELECT * FROM records WHERE id=?',[1]],
 ['SELECT * FROM events WHERE record_id=?',[1]],
]);
assert.equal(inserted[0].meta.last_row_id,1);assert.equal(inserted[3].results[0].record_id,1);assert.equal(JSON.parse(inserted[2].results[0].data).title,injected);
await batch([['INSERT INTO settings(key,value) VALUES(?,?)',['rate','1']]]);
const throttle=await batch([["INSERT INTO settings(key,value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT) RETURNING value",['rate']]]);
assert.equal(throttle[0].results[0].value,'2');
const conflict=await batch([
 ['UPDATE records SET version=version+1 WHERE id=? AND version=?',[1,99]],
 ["INSERT INTO events(record_id,org,actor,action,data,created_at) SELECT ?,?,?,?,?,? WHERE changes()>0",[1,'DO','test','must not write','{}',at]],
]);assert.equal(conflict[0].meta.changes,0);assert.equal(conflict[1].meta.changes,0);
const updated=await batch([
 ['UPDATE records SET version=version+1 WHERE id=? AND version=?',[1,1]],
 ["INSERT INTO events(record_id,org,actor,action,data,created_at) SELECT ?,?,?,?,?,? WHERE changes()>0",[1,'DO','test','valid update','{}',at]],
]);assert.equal(updated[0].meta.changes,1);assert.equal(updated[1].meta.changes,1);
await assert.rejects(()=>batch([['UPDATE records SET version=version+1 WHERE id=?',[1]],['INSERT INTO members(id) VALUES(?)',['invalid']]]));
assert.equal((await batch([['SELECT version FROM records WHERE id=?',[1]]]))[0].results[0].version,2);
const json=await batch([["UPDATE records SET data=json_set(data,'$.result.status',?,'$.result.targetId',?,'$.result.version',(SELECT version FROM records WHERE id=?)) WHERE id=?",['applied','task:1',1,1]],['SELECT json_extract(data,?) AS status FROM records WHERE id=?',['$.result.status',1]]]);assert.equal(json[1].results[0].status,'applied');
const doc=JSON.parse((await batch([['SELECT data FROM records WHERE id=?',[1]]]))[0].results[0].data);assert.equal(doc.result.version,2);
await batch([['INSERT OR IGNORE INTO records(kind,org,assignee,data,dedup,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',['task','DO','do','{}','test',at,at]]]);
await batch([['INSERT INTO settings(key,value) VALUES(?,?)',['service-settlement:v1:1','{"x":1}']]]);
const wallets=await batch([["SELECT json_group_array(json_object('key',key,'value',value)) AS wallets FROM (SELECT key,value FROM settings WHERE key LIKE 'service-settlement:v1:%' ORDER BY key)"]]);
assert.equal(wallets[0].results[0].wallets,JSON.stringify([{key:'service-settlement:v1:1',value:'{"x":1}'}]));
const limit=await batch([['SELECT * FROM records WHERE (?=0 OR id<?) ORDER BY id DESC LIMIT ?',[0,0,20]]]);assert.equal(limit[0].results.length,1);
const blocked=await pg.query<{anon:boolean;authenticated:boolean}>("SELECT has_function_privilege('anon','public.chartclean_erp_batch(jsonb)','EXECUTE') AS anon,has_function_privilege('authenticated','public.chartclean_erp_batch(jsonb)','EXECUTE') AS authenticated");assert.equal(blocked.rows[0].anon,false);assert.equal(blocked.rows[0].authenticated,false);
assert.throws(()=>postgresStatement('SELECT * FROM records; DROP TABLE members'));
console.log('PASS: identity, injection isolation, throttling, CAS, rollback, JSON, aggregate, pagination, private RPC');
await pg.close();
