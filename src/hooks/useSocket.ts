import { useContext } from 'react'
import { SocketContext } from '../context/SocketContext'

/**
 * Accede al socket único del contexto y a su estado de conexión.
 *
 * @example
 * const { socket, connected } = useSocket()
 * useEffect(() => {
 *   if (!socket) return
 *   socket.on('message:new', (msg) => console.log(msg))
 *   return () => { socket.off('message:new') }
 * }, [socket])
 */
export function useSocket() {
  const ctx = useContext(SocketContext)
  if (ctx === undefined) {
    throw new Error('useSocket debe usarse dentro de <SocketProvider>')
  }
  return ctx
}
