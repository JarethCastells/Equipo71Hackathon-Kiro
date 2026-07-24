import { Router, type NextFunction, type Request, type Response } from 'express'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { listActivity } from '../activityStore.js'

const router = Router()

type AsyncHandler = (req: AuthedRequest, res: Response, next: NextFunction) => Promise<unknown>
function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as AuthedRequest, res, next).catch(next)
  }
}

router.get('/', requireAuth, asyncRoute(async (req, res) => {
  const entries = await listActivity(req.auth!.sub, 30)
  res.json({ entries })
}))

export default router
