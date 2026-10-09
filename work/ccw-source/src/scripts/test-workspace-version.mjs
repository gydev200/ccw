import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workspaceVersion} from '../lib/workspace-version.ts';
import {loginDestination} from '../lib/login-destination.ts';
test('Only ccw32 at the kyunghwa seat enters v2',()=>{
 assert.equal(workspaceVersion('ccw32','kyunghwa'),'v2');
 assert.equal(workspaceVersion('ccw32','do'),'existing');
 assert.equal(workspaceVersion('another','kyunghwa'),'existing');
 assert.equal(workspaceVersion('','kyunghwa'),'existing');
});
test('Password requirement precedes v2, DO and staff routing',()=>{
 assert.equal(loginDestination({role:'staff',workspaceVersion:'v2'},true),'/password');
 assert.equal(loginDestination({role:'staff',workspaceVersion:'v2'},false),'/v2');
 assert.equal(loginDestination({role:'DO'},false),'/');
 assert.equal(loginDestination({role:'DO'},false,'/hr'),'/hr');
 assert.equal(loginDestination({role:'staff'},false,'/v2'),'/employee');
});
