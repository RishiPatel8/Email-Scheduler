import { Request, Response, NextFunction } from 'express';
export declare const previewLeads: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const createCampaign: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getScheduledEmails: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getSentEmails: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getDashboardStats: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=campaign.d.ts.map