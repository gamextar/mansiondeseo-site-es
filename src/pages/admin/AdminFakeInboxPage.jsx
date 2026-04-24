import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Bot, Inbox, MessageCircle, RefreshCw, Search, Send, UserRound } from 'lucide-react';
import AvatarImg from '../../components/AvatarImg';
import { adminGetFakeInbox, adminGetFakeInboxConversation, adminReplyFakeInbox } from '../../lib/api';

function formatDateTime(value) {
  if (!value) return 'Sin fecha';
  const normalized = value.endsWith('Z') ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Participant({ user, label, tone = 'real' }) {
  const isFake = tone === 'fake';
  return (
    <div className="flex min-w-0 items-center gap-3">
      <AvatarImg
        src={user?.avatar_url || ''}
        crop={user?.avatar_crop || null}
        alt={user?.username || label}
        className={`h-11 w-11 rounded-full border object-cover ${isFake ? 'border-amber-400/30' : 'border-emerald-400/30'}`}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-text-dim">
          {isFake ? <Bot className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
          {label}
        </div>
        <div className="truncate text-sm font-semibold text-text-primary">{user?.username || 'Sin username'}</div>
        <div className="truncate text-[11px] text-text-dim">{user?.id || '-'}</div>
      </div>
    </div>
  );
}

export default function AdminFakeInboxPage() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [thread, setThread] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const fetchInbox = useCallback(async (nextPage = page, nextQuery = query) => {
    setLoading(true);
    try {
      const data = await adminGetFakeInbox({ page: nextPage, limit: 20, q: nextQuery });
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
      setPage(Number(data.page) || 1);
      setPages(Math.max(1, Number(data.pages) || 1));
      setTotal(Number(data.total) || 0);
    } catch (err) {
      alert(err.message || 'Error al cargar la bandeja');
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    fetchInbox(1, query);
  }, [fetchInbox, query]);

  const openConversation = async (conversation) => {
    setSelected(conversation);
    setThreadLoading(true);
    setThread(null);
    setReplyText('');
    try {
      const data = await adminGetFakeInboxConversation({
        realId: conversation.sender.id,
        fakeId: conversation.receiver.id,
        limit: 120,
      });
      setThread(data);
    } catch (err) {
      alert(err.message || 'No se pudo abrir la conversación');
    } finally {
      setThreadLoading(false);
    }
  };

  const handleSearch = (event) => {
    event.preventDefault();
    setQuery(searchInput.trim());
  };

  const handleReply = async (event) => {
    event.preventDefault();
    const content = replyText.trim();
    if (!selected || !content || sendingReply) return;
    setSendingReply(true);
    try {
      const data = await adminReplyFakeInbox({
        realId: selected.sender.id,
        fakeId: selected.receiver.id,
        content,
      });
      const message = data?.message;
      if (message) {
        setThread((prev) => ({
          ...(prev || {}),
          messages: [
            ...(prev?.messages || []).map((item) => (
              item.direction === 'real_to_fake' ? { ...item, is_read: true } : item
            )),
            message,
          ],
        }));
      }
      setReplyText('');
      setConversations((prev) => prev.map((conversation) => (
        conversation.id === selected.id
          ? {
              ...conversation,
              messages_count: Number(conversation.messages_count || 0) + 1,
              unread_count: 0,
            }
          : conversation
      )));
      setSelected((prev) => prev ? { ...prev, unread_count: 0 } : prev);
    } catch (err) {
      alert(err.message || 'No se pudo enviar la respuesta');
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="min-h-screen bg-mansion-base px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 rounded-3xl border border-mansion-border/30 bg-mansion-card/60 p-5 backdrop-blur-xl lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mansion-gold/12 text-mansion-gold">
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-text-primary">Bandeja Fake</h1>
              <p className="text-sm text-text-dim">Mensajes enviados por usuarios reales a perfiles fake/placeholders</p>
            </div>
          </div>
          <div className="rounded-2xl border border-mansion-border/20 bg-black/20 px-4 py-3 text-sm text-text-muted">
            {total} conversaciones
          </div>
        </div>

        <div className="rounded-3xl border border-mansion-border/30 bg-mansion-card/50 p-4 backdrop-blur-xl">
          <form onSubmit={handleSearch} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="flex items-center gap-3 rounded-2xl border border-mansion-border/30 bg-black/20 px-4 py-3">
              <Search className="h-4 w-4 text-text-dim" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Buscar por usuario, mensaje o ID"
                className="w-full border-0 bg-transparent p-0 text-sm focus:ring-0"
              />
            </label>
            <button type="submit" className="btn-gold justify-center">Buscar</button>
            <button type="button" onClick={() => fetchInbox(page, query)} className="btn-ghost flex items-center justify-center gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Recargar
            </button>
          </form>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-4">
            {loading && (
              <div className="rounded-3xl border border-mansion-border/20 bg-mansion-card/40 p-8 text-center text-text-dim">
                Cargando bandeja...
              </div>
            )}

            {!loading && conversations.length === 0 && (
              <div className="rounded-3xl border border-mansion-border/20 bg-mansion-card/40 p-8 text-center text-text-dim">
                No hay mensajes de usuarios reales hacia perfiles fake con esos filtros.
              </div>
            )}

            {!loading && conversations.map((conversation) => {
              const isSelected = selected?.id === conversation.id;
              return (
                <article
                  key={conversation.id}
                  className={`rounded-3xl border bg-mansion-card/45 p-5 backdrop-blur-xl transition-colors ${
                    isSelected ? 'border-mansion-gold/40' : 'border-mansion-border/30 hover:border-mansion-border/60'
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center">
                        <Participant user={conversation.sender} label="Real envia" />
                        <ArrowRight className="hidden h-5 w-5 shrink-0 text-mansion-gold/70 md:block" />
                        <Participant user={conversation.receiver} label="Fake recibe" tone="fake" />
                      </div>
                      <div className="mt-4 rounded-2xl border border-mansion-border/20 bg-black/20 p-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-text-dim">
                          <span>{formatDateTime(conversation.last_message_at)}</span>
                          <span>·</span>
                          <span>{conversation.messages_count} mensajes</span>
                          {conversation.unread_count > 0 ? (
                            <>
                              <span>·</span>
                              <span className="font-semibold text-mansion-gold">{conversation.unread_count} sin leer por fake</span>
                            </>
                          ) : null}
                        </div>
                        <p className="line-clamp-2 text-sm text-text-muted">{conversation.last_message || 'Sin contenido'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openConversation(conversation)}
                      className="btn-gold flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-xs"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Ver mensajes
                    </button>
                  </div>
                </article>
              );
            })}

            <div className="flex items-center justify-between rounded-3xl border border-mansion-border/20 bg-mansion-card/35 px-4 py-3 text-sm text-text-muted">
              <span>Página {page} de {pages}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => fetchInbox(page - 1, query)} disabled={page <= 1 || loading} className="btn-ghost px-4 py-2 text-xs disabled:opacity-50">
                  Anterior
                </button>
                <button type="button" onClick={() => fetchInbox(page + 1, query)} disabled={page >= pages || loading} className="btn-ghost px-4 py-2 text-xs disabled:opacity-50">
                  Siguiente
                </button>
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-mansion-border/30 bg-mansion-card/50 p-4 backdrop-blur-xl xl:sticky xl:top-6 xl:max-h-[calc(100vh-48px)] xl:overflow-hidden">
            {!selected ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center text-text-dim">
                <MessageCircle className="mb-3 h-8 w-8 text-mansion-gold/70" />
                Seleccioná una conversación para ver el hilo.
              </div>
            ) : (
              <div className="flex h-full min-h-[420px] flex-col">
                <div className="border-b border-mansion-border/20 pb-4">
                  <div className="flex items-center gap-3">
                    <Participant user={selected.sender} label="Real" />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Participant user={selected.receiver} label="Fake" tone="fake" />
                  </div>
                </div>

                <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
                  {threadLoading && (
                    <div className="rounded-2xl border border-mansion-border/20 bg-black/20 p-5 text-center text-sm text-text-dim">
                      Cargando mensajes...
                    </div>
                  )}
                  {!threadLoading && thread?.messages?.map((message) => {
                    const fromReal = message.direction === 'real_to_fake';
                    return (
                      <div key={message.id} className={`flex ${fromReal ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[86%] rounded-2xl border px-4 py-3 ${
                          fromReal
                            ? 'border-emerald-400/20 bg-emerald-500/10'
                            : 'border-amber-400/20 bg-amber-500/10'
                        }`}>
                          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-dim">
                            {fromReal ? 'Real -> Fake' : 'Fake -> Real'}
                          </div>
                          <p className="whitespace-pre-wrap break-words text-sm text-text-primary">{message.content}</p>
                          <div className="mt-2 text-[10px] text-text-dim">{formatDateTime(message.created_at)}</div>
                        </div>
                      </div>
                    );
                  })}
                  {!threadLoading && thread?.messages?.length === 0 ? (
                    <div className="rounded-2xl border border-mansion-border/20 bg-black/20 p-5 text-center text-sm text-text-dim">
                      No hay mensajes en este hilo.
                    </div>
                  ) : null}
                </div>

                <form onSubmit={handleReply} className="mt-4 border-t border-mansion-border/20 pt-4">
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-text-dim">
                    Responder como {selected.receiver.username || 'fake'}
                  </label>
                  <textarea
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Escribir respuesta para el usuario real..."
                    className="mt-2 w-full resize-none rounded-2xl border border-mansion-border/30 bg-black/25 px-4 py-3 text-sm text-text-primary placeholder:text-text-dim focus:border-mansion-gold/50 focus:ring-mansion-gold/20"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-text-dim">
                      Sin realtime: se verá al actualizar o entrar al chat.
                    </span>
                    <button
                      type="submit"
                      disabled={!replyText.trim() || sendingReply}
                      className="btn-gold flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-xs disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      {sendingReply ? 'Enviando...' : 'Responder'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
