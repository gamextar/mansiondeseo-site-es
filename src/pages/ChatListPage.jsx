import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { mockConversations } from '../data/mockMessages';

export default function ChatListPage() {
  return (
    <div className="min-h-screen bg-mansion-base pb-24 lg:pb-8 pt-16">
      {/* Header */}
      <div className="px-4 lg:px-8 pt-4 lg:pt-6 pb-3">
        <h1 className="font-display text-2xl font-bold text-text-primary mb-4">Mensajes</h1>

        {/* Search bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
          <input
            type="text"
            placeholder="Buscar conversación..."
            className="w-full pl-10 py-2.5 text-sm"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="px-2 lg:px-6 lg:max-w-3xl">
        {mockConversations.map((conv, index) => (
          <motion.div
            key={conv.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Link
              to={`/mensajes/${conv.id}`}
              className="flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-mansion-card/50 transition-all group"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className={`w-14 h-14 rounded-full overflow-hidden ${
                  conv.unread > 0 ? 'ring-2 ring-mansion-gold/50' : ''
                }`}>
                  <img
                    src={conv.avatar}
                    alt={conv.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {conv.online && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-mansion-base" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className={`font-medium text-sm truncate ${
                    conv.unread > 0 ? 'text-text-primary' : 'text-text-muted'
                  }`}>
                    {conv.name}
                  </h3>
                  <span className={`text-[11px] flex-shrink-0 ml-2 ${
                    conv.unread > 0 ? 'text-mansion-gold' : 'text-text-dim'
                  }`}>
                    {conv.timestamp}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className={`text-xs truncate pr-2 ${
                    conv.unread > 0 ? 'text-text-primary font-medium' : 'text-text-dim'
                  }`}>
                    {conv.lastMessage}
                  </p>
                  {conv.unread > 0 && (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-mansion-crimson text-white text-[10px] font-bold flex items-center justify-center">
                      {conv.unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
