import type { NextFunction, Request, Response } from 'express';
import { ensureSeeded, findUserByUid } from '../db/repository.ts';
import type { UserAccount, UserRole } from '../types.ts';

export interface AuthRequest extends Request {
  dbUser?: UserAccount;
  effectiveRole?: UserRole;
  effectiveStudentId?: string | null;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const uidHeader = req.header('x-demo-user-id');
  if (!uidHeader) {
    res.status(401).json({ error: 'Unauthorized: Please select a demo account to continue.' });
    return;
  }

  try {
    await ensureSeeded();
    const dbUser = await findUserByUid(uidHeader);

    if (!dbUser) {
      res.status(401).json({ error: 'Unauthorized: Demo account not found.' });
      return;
    }

    if (!dbUser.active) {
      res.status(403).json({ error: 'This account has been suspended by an administrator.' });
      return;
    }

    req.dbUser = dbUser;
    req.effectiveRole = dbUser.role;
    req.effectiveStudentId = dbUser.linked_student_id;
    next();
  } catch (error) {
    console.error('Demo auth lookup failed:', error);
    res.status(500).json({ error: 'Failed to verify demo user session.' });
  }
};

export function requireRole(...allowed: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const role = req.effectiveRole;
    if (!role || !allowed.includes(role)) {
      res.status(403).json({
        error: `Access denied for role '${role ?? 'unknown'}'. Required: ${allowed.join(' or ')}.`,
      });
      return;
    }
    next();
  };
}
