import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import ChatPage from './ChatPage';
import { ChatConversationsPanel } from './ChatListPage';

function normalizeRouteId(id) {
  if (!id) return '';
  return String(id).startsWith('conv-') ? String(id).replace('conv-', '') : String(id);
}

export default function ChatDesktopPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const activeProfileId = normalizeRouteId(id);

  const handleSelectConversation = useCallback((conversation, { partnerPreview } = {}) => {
    if (!conversation?.profileId) return;
    navigate(`/mensajes/${conversation.profileId}`, {
      state: {
        from: '/mensajes',
        partnerPreview,
      },
    });
  }, [navigate]);

  return (
    <div className="hidden h-screen min-h-0 bg-mansion-base lg:flex">
      <aside className="flex h-full w-[360px] min-w-[320px] max-w-[380px] flex-col border-r border-mansion-border/30 bg-mansion-base">
        <ChatConversationsPanel
          embedded
          activeProfileId={activeProfileId}
          onSelect={handleSelectConversation}
        />
      </aside>

      <section className="min-w-0 flex-1 border-l border-white/[0.02] bg-mansion-base">
        {activeProfileId ? (
          <ChatPage
            key={activeProfileId}
            conversationId={activeProfileId}
            embeddedDesktop
          />
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <div>
              <MessageCircle className="mx-auto mb-5 h-12 w-12 text-text-dim" />
              <h2 className="font-display text-2xl text-text-primary">Selecciona una conversación</h2>
              <p className="mt-2 max-w-sm text-sm text-text-dim">
                Elige un chat de la lista para abrirlo en este panel.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
