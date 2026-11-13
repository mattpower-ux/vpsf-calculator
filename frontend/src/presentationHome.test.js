import test from 'node:test';
import assert from 'node:assert/strict';
import {presentationAddress,isPresentationAddress} from './presentationHome.js';

test('fictional home recognition tolerates punctuation and common abbreviations',()=>{
 for(const address of [presentationAddress,'53017 Double View Ln, Idyllwild CA 92549','53017  DOUBLE VIEW LANE Idyllwild California 92549','53017 Double View Ln.']) assert.equal(isPresentationAddress(address),true,address);
 for(const address of ['53015 Double View Drive, Idyllwild CA 92549','53017 Double View Lane, Bangor ME 04401','53019 Double View Lane, Idyllwild CA 92549','']) assert.equal(isPresentationAddress(address),false,address);
});
