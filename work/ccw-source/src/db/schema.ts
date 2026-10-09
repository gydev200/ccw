import {sqliteTable,text,integer,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const settings=sqliteTable('settings',{key:text('key').primaryKey(),value:text('value').notNull()});
export const members=sqliteTable('members',{id:text('id').primaryKey(),person:text('person').notNull(),role:text('role').notNull(),dss:integer('dss').notNull().default(0),label:text('label').notNull(),active:integer('active').notNull().default(1),createdAt:text('created_at').notNull()},t=>[uniqueIndex('members_person_unique').on(t.person)]);
export const records=sqliteTable('records',{id:integer('id').primaryKey({autoIncrement:true}),kind:text('kind').notNull(),org:text('org').notNull(),assignee:text('assignee').notNull(),data:text('data').notNull(),version:integer('version').notNull().default(1),dedup:text('dedup').unique(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()},t=>[index('records_kind_org_assignee').on(t.kind,t.org,t.assignee)]);
export const events=sqliteTable('events',{id:integer('id').primaryKey({autoIncrement:true}),recordId:integer('record_id').notNull(),org:text('org').notNull(),actor:text('actor').notNull(),action:text('action').notNull(),data:text('data').notNull(),createdAt:text('created_at').notNull()},t=>[index('events_record_id').on(t.recordId)]);
export const files=sqliteTable('files',{id:text('id').primaryKey(),recordId:integer('record_id').notNull(),org:text('org').notNull(),name:text('name').notNull(),type:text('type').notNull(),size:integer('size').notNull(),actor:text('actor').notNull(),createdAt:text('created_at').notNull()},t=>[index('files_record_id').on(t.recordId)]);
export const times=sqliteTable('times',{id:integer('id').primaryKey({autoIncrement:true}),recordId:integer('record_id').notNull(),org:text('org').notNull(),person:text('person').notNull(),minutes:integer('minutes').notNull(),date:text('date').notNull(),note:text('note').notNull(),createdAt:text('created_at').notNull()},t=>[index('times_person_date').on(t.person,t.date)]);
export const drafts=sqliteTable('drafts',{id:text('id').primaryKey(),data:text('data').notNull(),updatedAt:text('updated_at').notNull()});
export const controlEntries=sqliteTable('control_entries',{id:integer('id').primaryKey({autoIncrement:true}),kind:text('kind').notNull(),person:text('person').notNull(),org:text('org').notNull(),data:text('data').notNull(),history:text('history').notNull().default('[]'),version:integer('version').notNull().default(1),dedup:text('dedup').unique(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()},t=>[index('control_kind_person').on(t.kind,t.person)]);

// Append to db/schema.ts; owner generates a new Drizzle migration.
export const hrEntries = sqliteTable('hr_entries', {
 id: integer('id').primaryKey({autoIncrement:true}),
 kind: text('kind').notNull(),
 sourceId: text('source_id').notNull(),
 person: text('person').notNull(),
 data: text('data').notNull(),
 history: text('history').notNull().default('[]'),
 version: integer('version').notNull().default(1),
 createdAt: text('created_at').notNull(),
 updatedAt: text('updated_at').notNull()
},t=>[uniqueIndex('hr_entries_kind_source').on(t.kind,t.sourceId),index('hr_entries_kind_person').on(t.kind,t.person)]);
