/**
 * Tests para useConversations.
 *
 * Verifica:
 * - Carga inicial via REST.
 * - Refresco al recibir evento `conversation:updated` por socket.
 * - Polling fallback cuando el socket no está conectado.
 * - Estado de error cuando la llamada REST falla.
 *
 * Requisitos: 2.1, 2.3, 2.4
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useConversations } from './useConversations'
import * as api from '../lib/api'
import type { ConversationSummary } from '../lib/api'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../lib/api', () => ({
  listConversations: vi.fn(),
}))

// Mapa de handlers registrados: event → handler[]
const socketHandlers: Record<string, ((...args: unknown[]) => void)[]> = {}

const mockSocket = {
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    socketHandlers[event] = socketHandlers[event] ?? []
    socketHandlers[event].push(handler)
  }),
  off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    socketHandlers[event] = (socketHandlers[event] ?? []).filter((h) => h !== handler)
  }),
}

let connectedValue = true

vi.mock('./useSocket', () => ({
  useSocket: () => ({
    socket: mockSocket,
    connected: connectedValue,
  }),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'freelancer' as const,
  emailVerified: true,
  avatarUrl: null,
  bio: null,
  pendingEmail: null,
  totpEnabled: false,
  plan: 'libre' as const,
  notifyNewMatches: true,
  notifySecurity: true,
  notifyMessagesEmail: true,
  notifyMessagesPhone: false,
  phoneNumber: null,
  onboardingCompleted: true,
  profession: null,
  location: null,
  interests: null,
  rateType: null,
  rateAmount: null,
  cvUrl: null,
  availability: null,
  createdAt: '2024-01-01T00:00:00.000Z',
}

function makeConv(id: string, lastMessageAt: string): ConversationSummary {
  return {
    id,
    createdBy: 'u1',
    isGroup: false,
    title: null,
    lastMessageAt,
    createdAt: '2024-01-01T00:00:00.000Z',
    otherParticipant: MOCK_USER,
    lastMessage: null,
    unreadCount: 0,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(socketHandlers).forEach((k) => delete socketHandlers[k])
    connectedValue = true
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('comienza en estado de carga', () => {
    vi.mocked(api.listConversations).mockResolvedValue([])
    const { result } = renderHook(() => useConversations())
    expect(result.current.loading).toBe(true)
  })

  it('carga conversaciones y desactiva loading', async () => {
    const conversations = [makeConv('conv-1', '2024-06-01T12:00:00.000Z')]
    vi.mocked(api.listConversations).mockResolvedValue(conversations)

    const { result } = renderHook(() => useConversations())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.conversations).toHaveLength(1)
    expect(result.current.error).toBeNull()
  })

  it('devuelve error cuando falla la carga', async () => {
    vi.mocked(api.listConversations).mockRejectedValue(new Error('Fallo de red'))

    const { result } = renderHook(() => useConversations())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toMatch(/fallo de red/i)
    expect(result.current.conversations).toHaveLength(0)
  })

  it('recarga al recibir conversation:updated y reordena la lista', async () => {
    const initial = [
      makeConv('conv-a', '2024-06-01T10:00:00.000Z'),
      makeConv('conv-b', '2024-06-01T09:00:00.000Z'),
    ]
    // Tras el evento, conv-b pasa a ser la más reciente (simulado por el servidor)
    const updated = [
      makeConv('conv-b', '2024-06-01T11:00:00.000Z'),
      makeConv('conv-a', '2024-06-01T10:00:00.000Z'),
    ]

    vi.mocked(api.listConversations)
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(updated)

    const { result } = renderHook(() => useConversations())

    // Esperar carga inicial
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.conversations[0].id).toBe('conv-a')

    // Disparar el evento del socket
    act(() => {
      socketHandlers['conversation:updated']?.forEach((h) => h())
    })

    // Debe haber llamado a listConversations de nuevo
    await waitFor(() => expect(api.listConversations).toHaveBeenCalledTimes(2))
    expect(result.current.conversations[0].id).toBe('conv-b')
  })

  it('usa polling cuando el socket no está conectado', async () => {
    vi.useFakeTimers()
    connectedValue = false
    vi.mocked(api.listConversations).mockResolvedValue([])

    renderHook(() => useConversations())

    // Carga inicial
    await act(async () => { await Promise.resolve() })
    expect(api.listConversations).toHaveBeenCalledTimes(1)

    // Avanzar 30s para el polling
    await act(async () => {
      vi.advanceTimersByTime(30_000)
      await Promise.resolve()
    })

    expect(api.listConversations).toHaveBeenCalledTimes(2)
  })

  it('no usa polling cuando el socket está conectado', async () => {
    vi.useFakeTimers()
    connectedValue = true
    vi.mocked(api.listConversations).mockResolvedValue([])

    renderHook(() => useConversations())

    await act(async () => { await Promise.resolve() })
    expect(api.listConversations).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(30_000)
      await Promise.resolve()
    })

    // Sin polling adicional cuando el socket está activo
    expect(api.listConversations).toHaveBeenCalledTimes(1)
  })

  it('expone reload para forzar recarga manual', async () => {
    vi.mocked(api.listConversations).mockResolvedValue([])

    const { result } = renderHook(() => useConversations())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.reload() })

    await waitFor(() => expect(api.listConversations).toHaveBeenCalledTimes(2))
  })

  it('devuelve lista vacía cuando no hay conversaciones (no error)', async () => {
    vi.mocked(api.listConversations).mockResolvedValue([])

    const { result } = renderHook(() => useConversations())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.conversations).toEqual([])
    expect(result.current.error).toBeNull()
  })
})
