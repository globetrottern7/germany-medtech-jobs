'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { parsers, countryFrom } = require('../lib/sources');
const fx = (f) => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');

test('Bundesagentur parser normalises listing and keeps official URL', () => {
  const [l] = parsers.parseBundesagentur(JSON.parse(fx('bundesagentur.json')));
  assert.equal(l.company, 'Example Medical GmbH');
  assert.equal(l.country, 'Germany');
  assert.equal(l.location, 'Erlangen, Germany');
  assert.equal(l.verificationTier, 3);
  assert.match(l.officialUrl, /arbeitsagentur\.de\/jobsuche\/jobdetail\/10000-1199999999-S/);
  assert.deepEqual(l.coordinates, [49.59, 11.0]);
});

test('Greenhouse parser decodes HTML content', () => {
  const [l] = parsers.parseGreenhouse(JSON.parse(fx('greenhouse.json')), 'X Medical');
  assert.equal(l.country, 'Germany');
  assert.match(l.description, /recent graduates/);
  assert.doesNotMatch(l.description, /<p>/);
});

test('Personio XML parser extracts positions', () => {
  const [l] = parsers.parsePersonio(fx('personio.xml'), 'Example GmbH', 'example');
  assert.equal(l.externalId, '42');
  assert.equal(l.url, 'https://example.jobs.personio.de/job/42');
  assert.match(l.description, /IEC 62304/);
});

test('countryFrom handles names and codes', () => {
  assert.equal(countryFrom('Berlin, Deutschland'), 'Germany');
  assert.equal(countryFrom('Zug, CH'), 'Switzerland');
  assert.equal(countryFrom('Remote', 'Germany'), 'Germany');
});
