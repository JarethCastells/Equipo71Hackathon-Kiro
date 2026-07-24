/**
 * Tests para ConversationList y MessagesEmptyState.
 *
 * Cubre los estados: carga (skeleton), error (banner + reintento) y vacío.
 * También verifica el renderizado con datos reales y el filtrado por búsqueda.
 *
 * Requisitos validados: 2.1-2.4, 9.1
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ConversationSummary } from '../../lib/api';
import ConversationList from './ConversationList';

// framer-motion puede causar problemas con jsdom; lo simplificamos.
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const MOCK_USER_A = {
  id: 'user-a',
  name: 'Alice López',
  email: 'alice@example.com',
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
};

const MOCK_USER_B = {
  ...MOCK_USER_A,
  id: 'user-b',
  name: 'Bob García',
  email: 'bob@example.com',
};

const makeConversation = (overrides: Partial<ConversationSummary> = {}): ConversationSummary => ({
  id: 'conv-1',
  createdBy: 'user-a',
  isGroup: false,
  title: null,
  lastMessageAt: '2024-06-01T12:00:00.000Z',
  createdAt: '2024-06-01T10:00:00.000Z',
  otherParticipant: MOCK_USER_A,
  lastMessage: {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-a',
    body: 'Hola!',
    createdAt: '2024-06-01T12:00:00.000Z',
  },
  unreadCount: 0,
  ...overrides,
});

const defaultProps = {
  conversations: [] as ConversationSummary[],
  loading: false,
  error: null,
  selectedId: null,
  onSelect: vi.fn(),
  onRetry: vi.fn(),
};

describe('ConversationList', () => {
  it('muestra skeletons mientras carga', () => {
    render(<ConversationList {...defaultProps} loading={true} />);
    // Los skeletons tienen clases animate-pulse
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('muestra banner de error con botón reintentar', () => {
    const onRetry = vi.fn();
    render(<ConversationList {...defaultProps} error='Error de red' onRetry={onRetry} />);
    expect(screen.getByText('Error de red')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /reintentar/i });
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('muestra estado vacío cuando no hay conversaciones', () => {
    render(<ConversationList {...defaultProps} conversations={[]} />);
    expect(screen.getByText(/sin conversaciones aún/i)).toBeInTheDocument();
  });

  it('renderiza lista de conversaciones con datos', () => {
    const conversations = [
      makeConversation({ id: 'conv-1', otherParticipant: MOCK_USER_A }),
      makeConversation({ id: 'conv-2', otherParticipant: MOCK_USER_B }),
    ];
    render(<ConversationList {...defaultProps} conversations={conversations} />);
    expect(screen.getByText('Alice López')).toBeInTheDocument();
    expect(screen.getByText('Bob García')).toBeInTheDocument();
  });

  it('muestra el preview del último mensaje', () => {
    const conversations = [makeConversation({ otherParticipant: MOCK_USER_A })];
    render(<ConversationList {...defaultProps} conversations={conversations} />);
    expect(screen.getByText('Hola!')).toBeInTheDocument();
  });

  it('muestra "Sin mensajes aún" si no hay último mensaje', () => {
    const conversations = [makeConversation({ lastMessage: null, otherParticipant: MOCK_USER_A })];
    render(<ConversationList {...defaultProps} conversations={conversations} />);
    expect(screen.getByText('Sin mensajes aún')).toBeInTheDocument();
  });

  it('filtra conversaciones por nombre del participante', () => {
    const conversations = [
      makeConversation({ id: 'conv-1', otherParticipant: MOCK_USER_A }),
      makeConversation({ id: 'conv-2', otherParticipant: MOCK_USER_B }),
    ];
    render(<ConversationList {...defaultProps} conversations={conversations} />);
    const input = screen.getByPlaceholderText(/buscar conversaciones/i);
    fireEvent.change(input, { target: { value: 'alice' } });
    expect(screen.getByText('Alice López')).toBeInTheDocument();
    expect(screen.queryByText('Bob García')).not.toBeInTheDocument();
  });

  it('llama a onSelect al hacer clic en una fila', () => {
    const onSelect = vi.fn();
    const conversations = [makeConversation({ id: 'conv-1', otherParticipant: MOCK_USER_A })];
    render(
      <ConversationList {...defaultProps} conversations={conversations} onSelect={onSelect} />,
    );
    const item = screen.getByText('Alice López').closest('button')!;
    fireEvent.click(item);
    expect(onSelect).toHaveBeenCalledWith('conv-1');
  });

  it('muestra badge de no leídos en el avatar', () => {
    const conversations = [makeConversation({ unreadCount: 3, otherParticipant: MOCK_USER_A })];
    render(<ConversationList {...defaultProps} conversations={conversations} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('no muestra badge si no hay no leídos', () => {
    const conversations = [makeConversation({ unreadCount: 0, otherParticipant: MOCK_USER_A })];
    render(<ConversationList {...defaultProps} conversations={conversations} />);
    // No debe aparecer ningún elemento con "0"
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
