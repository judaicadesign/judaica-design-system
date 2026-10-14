import assert from 'node:assert/strict';
import {b612Base} from '../supabase/functions/_shared/jd-b612-base.mjs';
assert.deepEqual(b612Base(116135.42),{net:116135.42,roundedNet:116500,multiplier:1.26,multiplied:146790,x:146800});
assert.equal(b612Base(100000).x,126000);
assert.equal(b612Base(100000.01).x,126700);
assert.equal(b612Base(500).x,700);
for(const amount of [0,-1,NaN,Infinity])assert.throws(()=>b612Base(amount));
console.log('PASS B612 transform: round up to 500, multiply 1.26, round up to 100. Exact multiples preserved.');
