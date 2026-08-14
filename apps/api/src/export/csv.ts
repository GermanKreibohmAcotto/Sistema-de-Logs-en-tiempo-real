/** RFC 4180 field escaping: quote a field iff it contains a comma, quote, or newline. */
export function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
