"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLeads = void 0;
const sync_1 = require("csv-parse/sync");
const parseLeads = (fileBuffer, isCsv) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emails = [];
    if (isCsv) {
        try {
            const records = (0, sync_1.parse)(fileBuffer, {
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
        }
        catch (e) {
            // fallback to text parse if csv fails
            const text = fileBuffer.toString('utf-8');
            text.split(/\r?\n/).forEach(line => {
                if (line.trim())
                    emails.push(line.trim());
            });
        }
    }
    else {
        // TXT file parsing
        const text = fileBuffer.toString('utf-8');
        text.split(/\r?\n/).forEach(line => {
            // Split by comma or space in case they put multiple on one line
            const parts = line.split(/[\s,]+/);
            parts.forEach(part => {
                if (part.trim())
                    emails.push(part.trim());
            });
        });
    }
    const result = {
        total: 0,
        valid: [],
        invalid: [],
        duplicates: 0
    };
    const uniqueEmails = new Set();
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
        }
        else {
            result.invalid.push(cleanEmail);
        }
    }
    return result;
};
exports.parseLeads = parseLeads;
//# sourceMappingURL=csvParser.js.map