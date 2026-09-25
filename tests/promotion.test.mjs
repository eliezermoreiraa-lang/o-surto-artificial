import test from 'node:test';
import assert from 'node:assert/strict';
import {supportPrice,promotionActive} from '../supabase/functions/_shared/promotion.mjs';
import {monthlyCheckout} from '../supabase/functions/asaas-monthly-support/shared.mjs';
test('campaign boundaries use Sao Paulo midnight',()=>{
  assert.equal(promotionActive('2026-09-24T23:59:59-03:00'),false);
  assert.equal(promotionActive('2026-09-25T00:00:00-03:00'),true);
  assert.equal(promotionActive('2026-10-05T23:59:59-03:00'),true);
  assert.equal(promotionActive('2026-10-06T00:00:00-03:00'),false);
});
test('all tiers discount during campaign and return to regular prices for new purchases',()=>{
  for(const [tier,regular] of Object.entries({supporter:50,highlight:100,vip:300})){
    assert.equal(supportPrice(tier,'2026-10-05T12:00:00-03:00'),regular/2);
    assert.equal(supportPrice(tier,'2026-10-06T12:00:00-03:00'),regular);
    for(const amount of [regular/2,regular])assert.equal(monthlyCheckout({id:'test',tier,amount},'customer','2027-01-01').items[0].value,amount);
  }
});
