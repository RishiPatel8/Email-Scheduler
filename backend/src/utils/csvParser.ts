import { parse } from 'csv-parse/sync';

export interface ParseResult {
  total: number;
  valid: string[];
  invalid: string[];
  duplicates: number;
}

export const parseLeads = (fileBuffer: Buffer, isCsv: boolean): ParseResult => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emails: string[] = [];
  
  if (isCsv) {
    try {
      const records = parse(fileBuffer, {
        columns: false,
        skip_empty_lines: true
      });
      
      // Assuming email might be in the first column or we just search the row
      for (const row of records) {
        if (Array.isArray(row)) {
          for (const cell of row) {
             if (typeof cell === 'string' && cell.trim() !== '') {
                 emails.push(cell.trim());
                 break; // assume one email per row to avoid false positives if text has multiple
             }
          }
        }
      }
    } catch (e) {
       // fallback to text parse if csv fails
       const text = fileBuffer.toString('utf-8');
       text.split(/\r?\n/).forEach(line => {
         if (line.trim()) emails.push(line.trim());
       });
    }
  } else {
    // TXT file parsing
    const text = fileBuffer.toString('utf-8');
    text.split(/\r?\n/).forEach(line => {
      // Split by comma or space in case they put multiple on one line
      const parts = line.split(/[\s,]+/);
      parts.forEach(part => {
        if (part.trim()) emails.push(part.trim());
      });
    });
  }

  const result: ParseResult = {
    total: 0,
    valid: [],
    invalid: [],
    duplicates: 0
  };

  const uniqueEmails = new Set<string>();

  for (const email of emails) {
    result.total++;
    const cleanEmail = email.toLowerCase();
    
    if (uniqueEmails.has(cleanEmail)) {
      result.duplicates++;
      continue;
    }

    uniqueEmails.add(cleanEmail);

    if (emailRegex.test(cleanEmail)) {
      result.valid.push(cleanEmail);
    } else {
      result.invalid.push(cleanEmail);
    }
  }

  return result;
};
