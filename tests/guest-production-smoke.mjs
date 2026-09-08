// Non-mutating production checks only. Never sends a valid create-payment request.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const base='https://ndfchglutpnbckpcrppy.supabase.co/functions/v1/';
const headers={origin:'https://osurtoartificial.com.br',apikey:'sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C','content-type':'application/json'};
for(const [body,expected] of [[{action:'create',tier:'vip',requestToken:randomBytes(32).toString('hex')},400],[{action:'create',tier:'free',amount:10,fullName:'Invalid Input Test',cpfCnpj:'11111111111',method:'pix',requestToken:randomBytes(32).toString('hex')},400],[{action:'status',requestToken:randomBytes(32).toString('hex')},404],[null,400]]){
 const r=await fetch(base+'asaas-guest-support',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(r.status,expected,await r.text());console.log('PASS production guest: expected '+expected);
}
const r=await fetch(base+'asaas-create-support-payment',{method:'POST',headers,body:'{}'});assert.equal(r.status,401);console.log('PASS member checkout still requires authentication');
