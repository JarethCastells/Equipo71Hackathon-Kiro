import { useState } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import ConversationList from '../components/messages/ConversationList';
import MessagePanel from '../components/messages/MessagePanel';
import MessagesEmptyState from '../components/messages/MessagesEmptyState';
import { useConversations } from '../hooks/useConversations';
import type { Conversation } from '../lib/api';

/**
 * Pantalla de mensajería directa — `/dashboard/mensajes`
 *
 * Layout de 2 columnas:
 * - Izquierda: bandeja de conversaciones (lista + búsqueda).
 * - Derecha: panel del chat activo con mensajes en tiempo real.
 *
 * Protegida por sesión vía ProtectedRoute en App.tsx.
 * Envuelta en DashboardLayout.
 */
export default function MessagesPage() {
  const { conversations, loading, error, reload } = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Conversación actualmente seleccionada (con todos los detalles del participante, etc.)
  const selectedConversation = conversations.find((c) => c.id === selectedId) ?? null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  const handleBack = () => {
    setSelectedId(null);
  };

  /**
   * Cuando el modal crea/recupera un DM, recargar la lista de conversaciones
   * para que aparezca el nuevo chat en la bandeja.
   */
  const handleConversationReady = (conversation: Conversation) => {
    setSelectedId(conversation.id);
    reload();
  };

  return (
    <DashboardLayout>
      {/* Contenedor de 2 columnas, ocupa toda la altura disponible */}
      <div className='flex h-[calc(100vh-73px)] gap-0 overflow-hidden rounded-2xl border border-white/10'>
        {/* ── Columna izquierda: bandeja ───────────────────────────────────── */}
        {/* En móvil se oculta cuando hay conversación seleccionada */}
        <aside
          className={`flex w-full shrink-0 flex-col border-r border-white/10 bg-ink-900/50 p-4 md:w-80 lg:w-96 ${
            selectedId ? 'hidden md:flex' : 'flex'
          }`}>
          <ConversationList
            conversations={conversations}
            loading={loading}
            error={error}
            selectedId={selectedId}
            onSelect={handleSelect}
            onRetry={reload}
            onConversationReady={handleConversationReady}
          />
        </aside>

        {/* ── Columna derecha: panel del chat ──────────────────────────────── */}
        <main className={`flex-1 flex-col md:flex ${selectedId ? 'flex' : 'hidden md:flex'}`}>
          {selectedConversation ? (
            <MessagePanel conversation={selectedConversation} onBack={handleBack} />
          ) : (
            <MessagesEmptyState noConversations={conversations.length === 0 && !loading} />
          )}
        </main>
      </div>
    </DashboardLayout>
  );
}
