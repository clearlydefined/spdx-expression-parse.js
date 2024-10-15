'use strict'

/* global it */

var assert = require('assert')
var p = require('..')

// The spec is unclear about tabs and newlines
it('forbids tabs and newlines', function () {
  assert.throws(function () { p('MIT\t') })
  assert.throws(function () { p('\nMIT') })
})

it('allows many spaces', function () {
  assert.deepEqual(
    p(' MIT'),
    {license: 'MIT'}
  )

  assert.deepEqual(
    p('MIT '),
    {license: 'MIT'}
  )

  assert.deepEqual(
    p('MIT  AND    BSD-3-Clause'),
    {
      left: {license: 'MIT'},
      conjunction: 'and',
      right: {license: 'BSD-3-Clause'}
    }
  )
})

it('forbids spaces between a license-id and a following `+`', function () {
  assert.throws(
    function () { p('MIT +') },
    /Space before `\+`/
  )
})

it('parses DocumentRefs and LicenseRefs', function () {
  assert.deepEqual(
    p('LicenseRef-something'),
    {license: 'LicenseRef-something'}
  )

  assert.deepEqual(
    p('DocumentRef-spdx-tool-1.2 : LicenseRef-MIT-Style-2'),
    {license: 'DocumentRef-spdx-tool-1.2:LicenseRef-MIT-Style-2'}
  )
})

// See the note in `parser.js`.
it('parses `AND`, `OR` and `WITH` with the correct precedence', function () {
  assert.deepEqual(
    p('MIT AND BSD-3-Clause AND CC-BY-4.0'),
    {
      left: {license: 'MIT'},
      conjunction: 'and',
      right: {
        left: {license: 'BSD-3-Clause'},
        conjunction: 'and',
        right: {license: 'CC-BY-4.0'}
      }
    }
  )

  assert.deepEqual(
    p('MIT AND BSD-3-Clause WITH GCC-exception-3.1 OR CC-BY-4.0 AND Apache-2.0'),
    {
      left: {
        left: {license: 'MIT'},
        conjunction: 'and',
        right: {license: 'BSD-3-Clause', exception: 'GCC-exception-3.1'}
      },
      conjunction: 'or',
      right: {
        left: {license: 'CC-BY-4.0'},
        conjunction: 'and',
        right: {license: 'Apache-2.0'}
      }
    }
  )
})

it('rejects invalid license and exception names by default', function () {
  assert.throws(
    function () { p('unknownLicense') },
    /`unknownLicense` is not a valid license name/
  )

  assert.throws(
    function () { p('MIT WITH unknownException') },
    /`unknownException` is not a valid exception name/
  )
})

it('accepts invalid license and exception names in relaxed mode', function () {
  assert.deepEqual(
    p('unknownLicense', {relaxed: true}),
    {noassertion: 'unknownLicense'}
  )

  assert.deepEqual(
    p('MIT WITH unknownException', {relaxed: true}),
    {license: 'MIT', exception: 'NOASSERTION'}
  )

  assert.deepEqual(
    p('MIT OR Commercial', {relaxed: true}),
    {
      left: {license: 'MIT'},
      conjunction: 'or',
      right: {noassertion: 'Commercial'}
    }
  )
})

it('uses licenseVisitor to normalize licenseIdentifiers', function () {
  assert.deepEqual(
    p('mit OR Apache-2.0', { licenseVisitor: function (identifier) {
      if (identifier === 'mit') return 'MIT'
      return identifier
    }}),
    {
      left: {license: 'MIT'},
      conjunction: 'or',
      right: {license: 'Apache-2.0'}
    }
  )
})

it('parses non-spdx licenses with noassertion', function () {
  assert.deepEqual(
    p('MIT OR Commercial', { relaxed: true }),
    {
      left: {license: 'MIT'},
      conjunction: 'or',
      right: {noassertion: 'Commercial'}
    }
  )
})

it('parses non-spdx exceptions with noassertion', function () {
  assert.deepEqual(
    p('Apache-2.0 WITH commons-clause', { relaxed: true }),
    {
      license: 'Apache-2.0',
      exception: 'NOASSERTION'
    }
  )
})

it('should parse BSD-3-Clause-Modification', function () {
  assert.deepEqual(
    p('BSD-3-Clause-Modification'),
    {license: 'BSD-3-Clause-Modification'})
})

describe('licenseRefLookup', function () {
  const licenseRefLookup = function (identifier) {
    if (identifier === 'afpl-9.0') return 'LicenseRef-scancode-afpl-9.0'
    if (identifier === 'activestate-community') return 'LicenseRef-scancode-activestate-community'
    if (identifier === 'ac3filter') return 'LicenseRef-scancode-ac3filter'
  }

  it('should parse single licenseRef', function () {
    assert.deepEqual(
      p('afpl-9.0', { licenseRefLookup }),
      {license: 'LicenseRef-scancode-afpl-9.0'}
    )
  })

  it('should parse licenseRef within bracket', function () {
    assert.deepEqual(
      p('(afpl-9.0)', { licenseRefLookup }),
      {license: 'LicenseRef-scancode-afpl-9.0'}
    )
  })

  it('should parse (licenseRef OR license)', function () {
    assert.deepEqual(
      p('(afpl-9.0 OR Apache-2.0)', { licenseRefLookup }),
      {
        left: {license: 'LicenseRef-scancode-afpl-9.0'},
        conjunction: 'or',
        right: {license: 'Apache-2.0'}
      }
    )
  })

  it('should parse license AND (licenseRef)', function () {
    assert.deepEqual(
      p('Apache-2.0 AND (afpl-9.0)', { licenseRefLookup }),
      {
        left: {license: 'Apache-2.0'},
        conjunction: 'and',
        right: {license: 'LicenseRef-scancode-afpl-9.0'}
      }
    )
  })

  it('should parse license AND (licenseRef AND licenseRef)', function () {
    assert.deepEqual(
      p('Apache-2.0 AND (afpl-9.0 AND afpl-9.0)', { licenseRefLookup }),
      {
        left: {license: 'Apache-2.0'},
        conjunction: 'and',
        right: {
          left: {license: 'LicenseRef-scancode-afpl-9.0'},
          conjunction: 'and',
          right: {license: 'LicenseRef-scancode-afpl-9.0'}
        }
      }
    )
  })

  it('should parse (licenseRef AND licenseRef) AND license', function () {
    assert.deepEqual(
      p('(afpl-9.0 AND afpl-9.0) AND Apache-2.0', { licenseRefLookup }),
      {
        right: {license: 'Apache-2.0'},
        conjunction: 'and',
        left: {
          left: {license: 'LicenseRef-scancode-afpl-9.0'},
          conjunction: 'and',
          right: {license: 'LicenseRef-scancode-afpl-9.0'}
        }
      }
    )
  })

  it('should parse license AND (licenseRef OR licenseRef)', function () {
    assert.deepEqual(
      p('Apache-2.0 AND (afpl-9.0 OR afpl-9.0)', { licenseRefLookup }),
      {
        left: {license: 'Apache-2.0'},
        conjunction: 'and',
        right: {
          left: {license: 'LicenseRef-scancode-afpl-9.0'},
          conjunction: 'or',
          right: {license: 'LicenseRef-scancode-afpl-9.0'}
        }
      }
    )
  })

  it('should parse AND licenses', () => {
    assert.deepEqual(
      p('MIT AND GPL-3.0', { licenseRefLookup }),
      {
        left: {license: 'MIT'},
        conjunction: 'and',
        right: {license: 'GPL-3.0'}
      }
    )
  })

  it('should parse license and licenseRef', () => {
    assert.deepEqual(
      p('AFL-1.1 AND afpl-9.0', { licenseRefLookup }),
      {
        left: {license: 'AFL-1.1'},
        conjunction: 'and',
        right: {license: 'LicenseRef-scancode-afpl-9.0'}
      }
    )
  })

  it('should parse licenseRef and license', () => {
    assert.deepEqual(
      p('afpl-9.0 AND MIT', { licenseRefLookup }),
      {
        left: {license: 'LicenseRef-scancode-afpl-9.0'},
        conjunction: 'and',
        right: {license: 'MIT'}
    })
  })

  it('should parse licenseRef and licenseRef', () => {
    assert.deepEqual(
      p('afpl-9.0 AND activestate-community', { licenseRefLookup }),
      {
        left: {license: 'LicenseRef-scancode-afpl-9.0'},
        conjunction: 'and',
        right: {license: 'LicenseRef-scancode-activestate-community'}
      }
    )
  })

  it('should parse licenseRef and licenseRef or licenseRef', () => {
    assert.deepEqual(
      p('afpl-9.0 AND activestate-community OR ac3filter', { licenseRefLookup }),
      {
        left: {
          left: {license: 'LicenseRef-scancode-afpl-9.0'},
          conjunction: 'and',
          right: {license: 'LicenseRef-scancode-activestate-community'}
        },
        conjunction: 'or',
        right: {license: 'LicenseRef-scancode-ac3filter'}
      }
    )
  })

  it('should parse INVALID to NOASSERTION', () => {
    assert.deepEqual(
      p('INVALID', {licenseRefLookup, relaxed: true}),
      {noassertion: 'INVALID'}
    )
  })

  it('should parse LicenseRef', () => {
    assert.deepEqual(
      p('LicenseRef-scancode-afpl-9.0 AND MIT', { licenseRefLookup }),
      {
        left: {license: 'LicenseRef-scancode-afpl-9.0'},
        conjunction: 'and',
        right: {license: 'MIT'}
      }
    )
  })
})