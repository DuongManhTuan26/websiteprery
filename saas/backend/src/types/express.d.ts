// Augments Express's Request with fields our middleware attaches, so
// downstream handlers get real typing instead of `any`.
export {};

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      workspaceId?: string;
      workspaceRole?: 'OWNER' | 'ADMIN' | 'MEMBER';
    }
  }
}
