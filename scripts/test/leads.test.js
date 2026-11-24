'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { collapseDuplicates, findCitylessMatch, cityless, uniqueLeadId } = require('../lib/leads');

const L = (o) => ({ status: 'needs_review', company: 'Cambridgeconsultantslimited', title: 'Graduate Mechanical/Biomedical Engineer (2027 start)', first_seen: '2026-11-24', last_seen: '2026-11-24', ...o });

test('cityless treats empty and country-only locations as having no city', () => {
  assert.ok(cityless({ location: '', country: '' }));
  assert.ok(cityless({ location: 'Germany', country: 'Germany' }));
  assert.ok(!cityless({ location: 'München, Germany', country: 'Germany' }));
});

test('collapses the old "Germany"-default copy into the newer cityless copy', () => {
  const old = L({ lead_id: 'a', location: 'Germany', country: 'Germany', last_seen: '2026-11-24' });
  const neu = L({ lead_id: 'b', location: '', country: '', last_seen: '2026-11-25' });
  assert.equal(collapseDuplicates([old, neu], '2026-11-25'), 1);
  assert.equal(old.status, 'duplicate');
  assert.equal(old.duplicateOf, 'b');
  assert.equal(neu.status, 'needs_review');
});

test('a copy with a real city wins over a cityless copy', () => {
  const a = L({ lead_id: 'a', location: '', last_seen: '2026-11-25' });
  const b = L({ lead_id: 'b', location: 'Cambridge', country: 'United Kingdom', last_seen: '2026-11-24' });
  collapseDuplicates([a, b], '2026-11-25');
  assert.equal(a.status, 'duplicate');
  assert.equal(b.status, 'needs_review');
});

test('same title in two different real cities stays as two leads', () => {
  const a = L({ lead_id: 'a', title: 'Embedded Electrical Engineer', location: 'Zurich', country: 'Switzerland' });
  const b = L({ lead_id: 'b', title: 'Embedded Electrical Engineer', location: 'Lausanne', country: 'Switzerland' });
  assert.equal(collapseDuplicates([a, b], '2026-11-25'), 0);
});

test('a cityless discovery matches an existing queued lead', () => {
  const queued = [L({ lead_id: 'a', location: 'Germany', country: 'Germany' })];
  assert.equal(findCitylessMatch(queued, { company: 'Cambridgeconsultantslimited', title: 'Graduate Mechanical/Biomedical Engineer (2027 start)', location: '' })?.lead_id, 'a');
  assert.equal(findCitylessMatch(queued, { company: 'Other', title: 'Graduate Mechanical/Biomedical Engineer (2027 start)', location: '' }), null);
});

test('uniqueLeadId avoids collisions', () => {
  assert.equal(uniqueLeadId('x', [{ lead_id: 'x' }, { lead_id: 'x-2' }]), 'x-3');
  assert.equal(uniqueLeadId('y', [{ lead_id: 'x' }]), 'y');
});
