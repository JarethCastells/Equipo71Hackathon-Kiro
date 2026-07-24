/**
 * Tests para NewConversationModal.
 *
 * Cubre: búsqueda de contactos, selección de usuario para iniciar DM,
 * comportamiento idempotente (nuevo vs. existente) y manejo de errores.
 *
 * Requisitos validados: 1.1, 1.2, 1.3, 1.4
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation, PublicUser } from '../../lib/api';
import NewConversationModal from './NewConversationModal';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Strip framer-motion props that aren't valid DOM attributes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stripMotionProps = ({ layout, initial, animate, exit, transition, ...rest }: any) => rest;

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...stripMotionProps(props)}>{children}</div>
    ),
    button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button {...stripMotionProps(props)}>{children}</button>
    ),
    p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
      <p {...stripMotionProps(props)}>{children}</p>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockSearchContacts = vi.fn<(q: string) => Promise<PublicUser[]>>();
const mockCreateConversation = vi.fn<(recipientId: string) => Promise<Conversation>>();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    searchContacts: (...args: Parameters<typeof mockSearchContacts>) => mockSearchContacts(...args),
    createConversation: (...args: Parameters<typeof mockCreateConversation>) =>
      mockCreateConversation(...args),
  };
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_USER: PublicUser = {
  id: 'user-b',
  name: 'Carlos Ramírez',
  email: 'carlos@example.com',
  role: 'freelancer',
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
};

const MOCK_CONVERSATION: Conversation = {
  id: 'conv-new',
  createdBy: 'user-a',
  isGroup: false,
  title: null,
  lastMessageAt: null,
  createdAt: '2024-06-01T00:00:00.000Z',
};

const defaultProps = {
  onClose: vi.fn(),
  onConversationReady: vi.fn(),
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Use real timers so debounce resolves naturally with waitFor
  vi.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NewConversationModal', () => {
  it('renderiza el modal con el campo de búsqueda', () => {
    render(<NewConversationModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/buscar por nombre o correo/i)).toBeInTheDocument();
  });

  it('muestra texto de ayuda cuando no hay query', () => {
    render(<NewConversationModal {...defaultProps} />);
    expect(screen.getByText(/escribe un nombre o correo/i)).toBeInTheDocument();
  });

  it('cierra al hacer clic en el botón X', () => {
    const onClose = vi.fn();
    render(<NewConversationModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Cerrar'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('llama a searchContacts con el query y muestra resultados', async () => {
    mockSearchContacts.mockResolvedValue([MOCK_USER]);
    render(<NewConversationModal {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText(/buscar por nombre o correo/i), {
      target: { value: 'carlos' },
    });

    await waitFor(
      () => {
        expect(mockSearchContacts).toHaveBeenCalledWith('carlos');
        expect(screen.getByText('Carlos Ramírez')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it('muestra "sin resultados" cuando la búsqueda devuelve vacío', async () => {
    mockSearchContacts.mockResolvedValue([]);
    render(<NewConversationModal {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText(/buscar por nombre o correo/i), {
      target: { value: 'nobody' },
    });

    await waitFor(
      () => expect(screen.getByText(/no se encontraron usuarios/i)).toBeInTheDocument(),
      { timeout: 2000 },
    );
  });

  it('REQ 1.1 — inicia un nuevo DM al seleccionar un usuario', async () => {
    mockSearchContacts.mockResolvedValue([MOCK_USER]);
    mockCreateConversation.mockResolvedValue(MOCK_CONVERSATION);

    const onConversationReady = vi.fn();
    const onClose = vi.fn();
    render(<NewConversationModal onClose={onClose} onConversationReady={onConversationReady} />);

    fireEvent.change(screen.getByPlaceholderText(/buscar por nombre o correo/i), {
      target: { value: 'carlos' },
    });

    await waitFor(() => screen.getByText('Carlos Ramírez'), { timeout: 2000 });

    fireEvent.click(screen.getByText('Carlos Ramírez').closest('button')!);

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith('user-b');
      expect(onConversationReady).toHaveBeenCalledWith(MOCK_CONVERSATION);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('REQ 1.2 — reabre la conversación existente (idempotente)', async () => {
    const existingConversation: Conversation = { ...MOCK_CONVERSATION, id: 'conv-existing' };
    mockSearchContacts.mockResolvedValue([MOCK_USER]);
    mockCreateConversation.mockResolvedValue(existingConversation);

    const onConversationReady = vi.fn();
    render(<NewConversationModal onClose={vi.fn()} onConversationReady={onConversationReady} />);

    fireEvent.change(screen.getByPlaceholderText(/buscar por nombre o correo/i), {
      target: { value: 'carlos' },
    });

    await waitFor(() => screen.getByText('Carlos Ramírez'), { timeout: 2000 });
    fireEvent.click(screen.getByText('Carlos Ramírez').closest('button')!);

    await waitFor(() => {
      // La misma llamada — el backend garantiza idempotencia devolviendo la conv. existente
      expect(mockCreateConversation).toHaveBeenCalledWith('user-b');
      expect(onConversationReady).toHaveBeenCalledWith(existingConversation);
    });
  });

  it('REQ 1.3/1.4 — muestra el error del servidor si createConversation falla', async () => {
    mockSearchContacts.mockResolvedValue([MOCK_USER]);
    mockCreateConversation.mockRejectedValue(
      new Error('No puedes enviarte un mensaje a ti mismo.'),
    );

    render(<NewConversationModal {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText(/buscar por nombre o correo/i), {
      target: { value: 'carlos' },
    });

    await waitFor(() => screen.getByText('Carlos Ramírez'), { timeout: 2000 });
    fireEvent.click(screen.getByText('Carlos Ramírez').closest('button')!);

    await waitFor(() =>
      expect(screen.getByText('No puedes enviarte un mensaje a ti mismo.')).toBeInTheDocument(),
    );
  });

  it('muestra error de búsqueda si searchContacts falla', async () => {
    mockSearchContacts.mockRejectedValue(new Error('Network error'));
    render(<NewConversationModal {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText(/buscar por nombre o correo/i), {
      target: { value: 'carlos' },
    });

    await waitFor(
      () => expect(screen.getByText(/no se pudo completar la búsqueda/i)).toBeInTheDocument(),
      { timeout: 2000 },
    );
  });
});
