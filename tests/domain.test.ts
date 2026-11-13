import test from 'node:test';
import assert from 'node:assert/strict';
import { isInstituteEmail, emailProblem } from '../lib/domain.ts';

test('accepts institute addresses, including departmental sub-domains', () => {
  for (const email of [
    'ch1230456@iitd.ac.in',
    'prof@cse.iitd.ac.in',
    'someone@maths.iitd.ac.in',
    'MixedCase@IITD.AC.IN',
    '  spaced@iitd.ac.in  ',
  ]) {
    assert.equal(isInstituteEmail(email), true, email);
  }
});

test('refuses the look-alike domains a substring check would let through', () => {
  for (const email of [
    'attacker@iitd.ac.in.evil.com',
    'attacker@notiitd.ac.in.co',
    'attacker@iitd.ac.in.in',
    'attacker@fakeiitd.ac.in.net',
  ]) {
    assert.equal(isInstituteEmail(email), false, email);
    // and the trap itself: the naive test would pass these
    assert.equal(email.includes('iitd.ac.in'), true, email);
  }
});

test('refuses other domains and malformed input', () => {
  for (const email of [
    'someone@gmail.com',
    'someone@iitb.ac.in',
    'someone@iitd.ac.uk',
    'no-at-sign',
    'two@at@iitd.ac.in',
    '@iitd.ac.in',
    'trailing@',
    '',
    null,
    undefined,
  ]) {
    assert.equal(isInstituteEmail(email as string), false, String(email));
  }
});

test('a sub-domain cannot be smuggled in with an extra label', () => {
  assert.equal(isInstituteEmail('x@iitd.ac.in.x'), false);
  assert.equal(isInstituteEmail('x@x.iitd.ac.in'), true);
});

test('the message names the requirement rather than just failing', () => {
  assert.match(emailProblem('someone@gmail.com')!, /iitd\.ac\.in/);
  assert.match(emailProblem('')!, /institute email/i);
  assert.equal(emailProblem('ok@iitd.ac.in'), null);
});
