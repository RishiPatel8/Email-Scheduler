export interface ParseResult {
    total: number;
    valid: string[];
    invalid: string[];
    duplicates: number;
}
export declare const parseLeads: (fileBuffer: Buffer, isCsv: boolean) => ParseResult;
//# sourceMappingURL=csvParser.d.ts.map