import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: string;
        firebaseUid: string;
        email: string;
        name?: string | null;
        picture?: string | null;
    };
}
export declare const requireAuth: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map