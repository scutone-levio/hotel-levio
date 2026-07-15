import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { sanitizeCsvField, buildCsvRow, buildCsv } from "./csv"

describe("sanitizeCsvField", () => {
  it("returns empty string for null", () => {
    assert.equal(sanitizeCsvField(null), "")
  })

  it("returns empty string for undefined", () => {
    assert.equal(sanitizeCsvField(undefined), "")
  })

  it("returns plain value unchanged", () => {
    assert.equal(sanitizeCsvField("hello"), "hello")
  })

  // Formula-injection neutralization
  it("prefixes = at start with single-quote", () => {
    assert.equal(sanitizeCsvField("=CMD()"), "'=CMD()")
  })

  it("prefixes + at start with single-quote", () => {
    assert.equal(sanitizeCsvField("+1234"), "'+1234")
  })

  it("prefixes - at start with single-quote", () => {
    assert.equal(sanitizeCsvField("-1234"), "'-1234")
  })

  it("prefixes @ at start with single-quote", () => {
    assert.equal(sanitizeCsvField("@SUM()"), "'@SUM()")
  })

  it("does NOT neutralize = appearing mid-value", () => {
    assert.equal(sanitizeCsvField("a=b"), "a=b")
  })

  it("does NOT neutralize + appearing mid-value", () => {
    assert.equal(sanitizeCsvField("a+b"), "a+b")
  })

  // Quoting
  it("wraps value containing comma in double-quotes", () => {
    assert.equal(sanitizeCsvField("a,b"), '"a,b"')
  })

  it("wraps value containing double-quote and escapes it", () => {
    assert.equal(sanitizeCsvField('say "hi"'), '"say ""hi"""')
  })

  it("wraps value containing newline in double-quotes", () => {
    assert.equal(sanitizeCsvField("line1\nline2"), '"line1\nline2"')
  })

  // Neutralization + quoting combined
  it("neutralizes formula AND quotes when value starts with = and contains comma", () => {
    assert.equal(sanitizeCsvField("=A1,B1"), '"\'=A1,B1"')
  })

  it("neutralizes Guest Name starting with =", () => {
    assert.equal(sanitizeCsvField("=malicious"), "'=malicious")
  })

  it("neutralizes Special Requests starting with @", () => {
    assert.equal(sanitizeCsvField("@room please"), "'@room please")
  })
})

describe("buildCsvRow", () => {
  it("joins fields with commas", () => {
    assert.equal(buildCsvRow(["a", "b", "c"]), "a,b,c")
  })

  it("sanitizes each field", () => {
    assert.equal(buildCsvRow(["=x", null, "y,z"]), "'=x,\"y,z\"")
  })
})

describe("buildCsv", () => {
  it("returns header-only CSV for empty rows", () => {
    assert.equal(buildCsv(["A", "B"], []), "A,B")
  })

  it("joins header and rows with CRLF", () => {
    const result = buildCsv(["A", "B"], [["1", "2"], ["3", "4"]])
    assert.equal(result, "A,B\r\n1,2\r\n3,4")
  })

  it("has no trailing newline", () => {
    const result = buildCsv(["A"], [["1"]])
    assert.ok(!result.endsWith("\r\n"))
  })
})
