const FORMULA_CHARS = new Set(["=", "+", "-", "@"])

export function sanitizeCsvField(value: string | null | undefined): string {
  if (value == null) return ""

  // Formula-injection neutralization — must run before quoting
  let v = FORMULA_CHARS.has(value[0]) ? `'${value}` : value

  // RFC 4180 quoting: wrap in double-quotes if the value contains a comma,
  // double-quote, or newline; escape internal double-quotes as ""
  if (v.includes(",") || v.includes('"') || v.includes("\n") || v.includes("\r")) {
    v = `"${v.replace(/"/g, '""')}"`
  }

  return v
}

export function buildCsvRow(fields: (string | null | undefined)[]): string {
  return fields.map(sanitizeCsvField).join(",")
}

export function buildCsv(
  headers: string[],
  rows: (string | null | undefined)[][],
): string {
  const lines = [buildCsvRow(headers), ...rows.map(buildCsvRow)]
  return lines.join("\r\n")
}
