"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const csvParser_1 = require("../utils/csvParser");
(0, vitest_1.describe)('CSV / TXT Parser', () => {
    (0, vitest_1.it)('should parse valid CSV and identify valid/invalid emails', () => {
        const csvContent = Buffer.from('test1@example.com\ninvalid-email\ntest2@example.com\n');
        const result = (0, csvParser_1.parseLeads)(csvContent, true);
        (0, vitest_1.expect)(result.total).toBe(3);
        (0, vitest_1.expect)(result.valid).toHaveLength(2);
        (0, vitest_1.expect)(result.valid).toContain('test1@example.com');
        (0, vitest_1.expect)(result.valid).toContain('test2@example.com');
        (0, vitest_1.expect)(result.invalid).toHaveLength(1);
        (0, vitest_1.expect)(result.invalid).toContain('invalid-email');
        (0, vitest_1.expect)(result.duplicates).toBe(0);
    });
    (0, vitest_1.it)('should identify duplicates', () => {
        const txtContent = Buffer.from('test@example.com\ntest@example.com\nanothertest@example.com');
        const result = (0, csvParser_1.parseLeads)(txtContent, false);
        (0, vitest_1.expect)(result.total).toBe(3);
        (0, vitest_1.expect)(result.valid).toHaveLength(2);
        (0, vitest_1.expect)(result.duplicates).toBe(1);
    });
    (0, vitest_1.it)('should parse TXT correctly separated by commas or spaces', () => {
        const txtContent = Buffer.from('test1@example.com, test2@example.com test3@example.com');
        const result = (0, csvParser_1.parseLeads)(txtContent, false);
        (0, vitest_1.expect)(result.total).toBe(3);
        (0, vitest_1.expect)(result.valid).toHaveLength(3);
    });
});
//# sourceMappingURL=csvParser.test.js.map