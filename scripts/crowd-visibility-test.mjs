import assert from 'node:assert/strict';
import {crowdVisibility} from '../frontend/src/visibility.ts';
const eye={x:0,y:3,z:-8},hero={x:0,y:1.5,z:0};
assert.ok(crowdVisibility(0,2.2,-4,.65,eye,hero)<.2,'foreground soldier must reveal hero');
assert.equal(crowdVisibility(0,1.5,3,.65,eye,hero),1,'enemy behind hero remains opaque');
assert.equal(crowdVisibility(5,2,-4,.65,eye,hero),1,'soldier beside sight line remains opaque');
assert.ok(crowdVisibility(1.5,2,-4,1.25,eye,hero)<.3,'mounted body must also fade');
assert.equal(crowdVisibility(0,1.5,0,.65,hero,hero),1,'degenerate camera must remain finite');
assert.equal(crowdVisibility(0,2.5,-8.4,1.25,eye,hero),0,'body behind the eye enclosing the camera must disappear');
for(let x=0;x<4;x+=.05){const a=crowdVisibility(x,2.2,-4,.65,eye,hero),b=crowdVisibility(x+.05,2.2,-4,.65,eye,hero);assert.ok(b>=a-1e-8 && b-a<.12,'fade boundary must be continuous');}
console.log('PASS: foreground, side, behind-hero, mounted and degenerate sight lines; continuous fade');
