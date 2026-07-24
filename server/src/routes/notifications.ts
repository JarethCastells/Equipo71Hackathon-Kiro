import { Router, type NextFunction, type Request, type Response } from 'express'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { countUnread, listNotifications, markAllRead, markOneRead } from '../notificationStore.js'

const router = Router()

type AsyncHandler = (req: AuthedRequest, res: Response, next: NextFunction) => Promise<unknown>
function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as AuthedRequest, res, next).catch(next)
  }
}

router.get('/', requireAuth, asyncRoute(async (req, res) => {
  const [entries, unreadCount] = await Promise.all([
    listNotifications(req.auth!.sub, 30),
    countUnread(req.auth!.sub),
  ])
  res.json({ entries, unreadCount })
}))

router.post('/read-all', requireAuth, asyncRoute(async (req, res) => {
  await markAllRead(req.auth!.sub)
  res.json({ message: 'Notificaciones marcadas como leídas.' })
}))

router.post('/:id/read', requireAuth, asyncRoute(async (req, res) => {
  await markOneRead(req.auth!.sub, req.params.id)
  res.json({ message: 'Notificación marcada como leída.' })
}))

export default router
