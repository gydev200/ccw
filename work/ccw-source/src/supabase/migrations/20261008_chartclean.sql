BEGIN;
CREATE SCHEMA IF NOT EXISTS chartclean_erp;
REVOKE ALL ON SCHEMA chartclean_erp FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA chartclean_erp TO service_role;
CREATE TABLE IF NOT EXISTS chartclean_erp.settings(key text PRIMARY KEY,value text NOT NULL);
CREATE TABLE IF NOT EXISTS chartclean_erp.members(id text PRIMARY KEY,person text NOT NULL UNIQUE,role text NOT NULL,dss bigint NOT NULL DEFAULT 0,label text NOT NULL,active bigint NOT NULL DEFAULT 1,created_at text NOT NULL);
CREATE TABLE IF NOT EXISTS chartclean_erp.records(id bigserial PRIMARY KEY,kind text NOT NULL,org text NOT NULL,assignee text NOT NULL,data text NOT NULL,version bigint NOT NULL DEFAULT 1,dedup text UNIQUE,created_at text NOT NULL,updated_at text NOT NULL);
CREATE TABLE IF NOT EXISTS chartclean_erp.events(id bigserial PRIMARY KEY,record_id bigint NOT NULL,org text NOT NULL,actor text NOT NULL,action text NOT NULL,data text NOT NULL,created_at text NOT NULL);
CREATE TABLE IF NOT EXISTS chartclean_erp.files(id text PRIMARY KEY,record_id bigint NOT NULL,org text NOT NULL,name text NOT NULL,type text NOT NULL,size bigint NOT NULL,actor text NOT NULL,created_at text NOT NULL);
CREATE TABLE IF NOT EXISTS chartclean_erp.times(id bigserial PRIMARY KEY,record_id bigint NOT NULL,org text NOT NULL,person text NOT NULL,minutes bigint NOT NULL,date text NOT NULL,note text NOT NULL,created_at text NOT NULL);
CREATE TABLE IF NOT EXISTS chartclean_erp.drafts(id text PRIMARY KEY,data text NOT NULL,updated_at text NOT NULL);
CREATE TABLE IF NOT EXISTS chartclean_erp.control_entries(id bigserial PRIMARY KEY,kind text NOT NULL,person text NOT NULL,org text NOT NULL,data text NOT NULL,history text NOT NULL DEFAULT '[]',version bigint NOT NULL DEFAULT 1,dedup text UNIQUE,created_at text NOT NULL,updated_at text NOT NULL);
CREATE TABLE IF NOT EXISTS chartclean_erp.hr_entries(id bigserial PRIMARY KEY,kind text NOT NULL,source_id text NOT NULL,person text NOT NULL,data text NOT NULL,history text NOT NULL DEFAULT '[]',version bigint NOT NULL DEFAULT 1,created_at text NOT NULL,updated_at text NOT NULL,UNIQUE(kind,source_id));
CREATE TABLE IF NOT EXISTS chartclean_erp.academy_answer_backups(id bigserial PRIMARY KEY,attempt_id bigint NOT NULL,attempt_version bigint NOT NULL,person text NOT NULL,status text NOT NULL,answer_count bigint NOT NULL,payload text NOT NULL,saved_at text NOT NULL,UNIQUE(attempt_id,attempt_version));
CREATE INDEX IF NOT EXISTS records_kind_org_assignee ON chartclean_erp.records(kind,org,assignee);
CREATE INDEX IF NOT EXISTS events_record_id ON chartclean_erp.events(record_id);
CREATE INDEX IF NOT EXISTS files_record_id ON chartclean_erp.files(record_id);
CREATE INDEX IF NOT EXISTS times_person_date ON chartclean_erp.times(person,date);
CREATE INDEX IF NOT EXISTS control_kind_person ON chartclean_erp.control_entries(kind,person);
CREATE INDEX IF NOT EXISTS hr_entries_kind_person ON chartclean_erp.hr_entries(kind,person);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['settings','members','records','events','files','times','drafts','control_entries','hr_entries','academy_answer_backups'] LOOP
  EXECUTE format('ALTER TABLE chartclean_erp.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON chartclean_erp.%I FROM PUBLIC, anon, authenticated',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON chartclean_erp.%I TO service_role',t);
 END LOOP;
END $$;
GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA chartclean_erp TO service_role;
CREATE OR REPLACE FUNCTION chartclean_erp.ccw_json_extract(doc text,path text) RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT doc::jsonb #>> string_to_array(substr(path,3),'.') $$;
CREATE OR REPLACE FUNCTION chartclean_erp.ccw_json_set(doc text,VARIADIC pairs text[]) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE j jsonb:=doc::jsonb; p text[]; i integer; n integer; prefix text[];
BEGIN
 IF array_length(pairs,1)%2<>0 THEN RAISE EXCEPTION 'Invalid JSON update'; END IF;
 FOR i IN 1..array_length(pairs,1) BY 2 LOOP
  p:=string_to_array(substr(pairs[i],3),'.');
  IF array_length(p,1)>1 THEN FOR n IN 1..array_length(p,1)-1 LOOP
   prefix:=p[1:n]; IF j #> prefix IS NULL OR jsonb_typeof(j #> prefix)<>'object' THEN j:=jsonb_set(j,prefix,'{}'::jsonb,true); END IF;
  END LOOP; END IF;
  j:=jsonb_set(j,p,COALESCE(to_jsonb(pairs[i+1]),'null'::jsonb),true);
 END LOOP;
 RETURN j::text;
END $$;
CREATE OR REPLACE FUNCTION chartclean_erp.ccw_json_set(doc text,p1 text,v1 text,p2 text,v2 text,p3 text,v3 bigint) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT jsonb_set(chartclean_erp.ccw_json_set(doc,VARIADIC ARRAY[p1,v1,p2,v2])::jsonb,string_to_array(substr(p3,3),'.'),COALESCE(to_jsonb(v3),'null'::jsonb),true)::text $$;
CREATE OR REPLACE FUNCTION chartclean_erp.ccw_changes() RETURNS bigint LANGUAGE sql VOLATILE AS $$ SELECT COALESCE(NULLIF(current_setting('chartclean.changes',true),''),'0')::bigint $$;
CREATE OR REPLACE FUNCTION chartclean_erp.ccw_last_id() RETURNS bigint LANGUAGE sql VOLATILE AS $$ SELECT COALESCE(NULLIF(current_setting('chartclean.last_id',true),''),'0')::bigint $$;
CREATE OR REPLACE FUNCTION chartclean_erp.ccw_json_object(VARIADIC pairs text[]) RETURNS json LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE j text:='{'; i integer; BEGIN
 FOR i IN 1..array_length(pairs,1) BY 2 LOOP
  IF i>1 THEN j:=j||','; END IF;
  j:=j||to_json(pairs[i])::text||':'||COALESCE(to_json(pairs[i+1])::text,'null');
 END LOOP; RETURN (j||'}')::json;
END $$;
CREATE OR REPLACE FUNCTION chartclean_erp.ccw_json_array_step(acc text,item json) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT COALESCE(acc||',','')||COALESCE(item::text,'null') $$;
CREATE OR REPLACE FUNCTION chartclean_erp.ccw_json_array_final(acc text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '['||COALESCE(acc,'')||']' $$;
CREATE AGGREGATE chartclean_erp.ccw_json_group_array(json)(SFUNC=chartclean_erp.ccw_json_array_step,STYPE=text,FINALFUNC=chartclean_erp.ccw_json_array_final);
CREATE OR REPLACE FUNCTION public.chartclean_erp_batch(statements jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=chartclean_erp,pg_catalog AS $$
DECLARE s jsonb; q text; rows jsonb; output jsonb:='[]'; changed bigint:=0; last_id bigint:=0; started timestamptz;
BEGIN
 IF jsonb_typeof(statements)<>'array' OR jsonb_array_length(statements)>300 THEN RAISE EXCEPTION 'Invalid request'; END IF;
 -- Serialize app mutations to preserve SQLite-style changes()/CAS batch semantics.
 PERFORM pg_advisory_xact_lock(731024,1);
 PERFORM set_config('chartclean.changes','0',true); PERFORM set_config('chartclean.last_id','0',true);
 FOR s IN SELECT value FROM jsonb_array_elements(statements) LOOP
  q:=s->>'sql'; started:=clock_timestamp();
  IF q IS NULL OR length(q)>4000000 OR q !~* '^(SELECT|INSERT|UPDATE|DELETE)\s' THEN RAISE EXCEPTION 'Invalid query'; END IF;
  IF (s->>'mutation')::boolean THEN
   EXECUTE 'WITH changed AS ('||q||') SELECT COALESCE(jsonb_agg(to_jsonb(changed)),''[]''::jsonb) FROM changed' INTO rows;
   changed:=jsonb_array_length(rows);
   IF (s->>'autoId')::boolean AND changed>0 THEN last_id:=(rows->(changed::integer-1)->>'id')::bigint; END IF;
   PERFORM set_config('chartclean.changes',changed::text,true); PERFORM set_config('chartclean.last_id',last_id::text,true);
  ELSE
   EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(result)),''[]''::jsonb) FROM ('||q||') result' INTO rows;
  END IF;
  output:=output||jsonb_build_array(jsonb_build_object('results',rows,'success',true,'meta',jsonb_build_object('changes',CASE WHEN (s->>'mutation')::boolean THEN changed ELSE 0 END,'last_row_id',last_id,'duration',extract(epoch FROM clock_timestamp()-started)*1000)));
 END LOOP;
 RETURN output;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA chartclean_erp FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA chartclean_erp TO service_role;
REVOKE ALL ON FUNCTION public.chartclean_erp_batch(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.chartclean_erp_batch(jsonb) TO service_role;
COMMIT;
