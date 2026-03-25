import { useState, useEffect, useCallback } from 'react';
import { Search, Crown, Shield, Trash2, ChevronLeft, ChevronRight, Eye, X, Coins, UserCheck, Ghost, Ban, AlertTriangle, Pause, Play } from 'lucide-react';
import { adminGetUsers, adminUpdateUser, adminDeleteUser } from '../../lib/api';

function timeAgo(dateStr) {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z').getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function roleBadge(role) {
  const map = { hombre: '♂', mujer: '♀', pareja: '♂♀' };
  return map[role] || role;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async (p = page, q = query) => {
    setLoading(true);
    try {
      const data = await adminGetUsers({ page: p, limit: 20, q });
      setUsers(data.users);
      setTotal(data.total);
      setPage(data.page);
      setPages(data.pages);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => { fetchUsers(1, query); }, [query]); // eslint-disable-line

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(searchInput);
  };

  const handleAction = async (userId, fields) => {
    setActionLoading(true);
    try {
      const data = await adminUpdateUser(userId, fields);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data.user } : u));
      if (selected?.id === userId) setSelected(s => ({ ...s, ...data.user }));
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (userId, email) => {
    if (!confirm(`¿Eliminar PERMANENTEMENTE a ${email}?\n\nEsto borrará todos sus mensajes, favoritos, visitas y regalos.`)) return;
    setActionLoading(true);
    try {
      await adminDeleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      setTotal(t => t - 1);
      setSelected(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-text-primary">Usuarios</h1>
          <p className="text-sm text-text-dim mt-1">{total} usuarios registrados</p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Buscar por email, nombre o ID..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-mansion-card border border-mansion-border/30 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-mansion-gold/40"
              />
            </div>
            <button type="submit" className="px-4 py-2.5 rounded-xl bg-mansion-gold/10 border border-mansion-gold/20 text-mansion-gold text-sm font-semibold hover:bg-mansion-gold/20 transition-colors">
              Buscar
            </button>
            {query && (
              <button type="button" onClick={() => { setSearchInput(''); setQuery(''); }} className="px-3 py-2.5 rounded-xl bg-mansion-elevated text-text-dim hover:text-text-primary transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>

        {/* Table */}
        <div className="bg-mansion-card rounded-2xl border border-white/5 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-text-dim">Cargando...</div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-text-dim">No se encontraron usuarios</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mansion-border/20 text-left text-[10px] text-text-dim uppercase tracking-wider">
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3 hidden md:table-cell">Email</th>
                    <th className="px-4 py-3 hidden lg:table-cell">País</th>
                    <th className="px-4 py-3 text-center">VIP</th>
                    <th className="px-4 py-3 text-center hidden sm:table-cell">Estado</th>
                    <th className="px-4 py-3 text-center hidden sm:table-cell">Coins</th>
                    <th className="px-4 py-3 hidden lg:table-cell">IP</th>
                    <th className="px-4 py-3 hidden md:table-cell">Actividad</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mansion-border/10">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-mansion-elevated/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-mansion-elevated overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-text-dim text-xs">{roleBadge(u.role)}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-text-primary font-medium truncate text-xs">{u.username}</span>
                              {u.online && <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />}
                              {u.is_admin && <Shield className="w-3 h-3 text-red-400 flex-shrink-0" />}
                            </div>
                            <p className="text-[10px] text-text-dim md:hidden truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs hidden md:table-cell truncate max-w-[200px]">{u.email}</td>
                      <td className="px-4 py-3 text-text-dim text-xs hidden lg:table-cell">{u.country || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {u.premium ? <Crown className="w-4 h-4 text-mansion-gold mx-auto" /> : <span className="text-text-dim text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        {u.account_status === 'suspended' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-semibold">Suspendida</span>
                        ) : u.account_status === 'under_review' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-semibold">En revisión</span>
                        ) : (
                          <span className="text-green-400 text-[10px]">Activa</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-text-muted hidden sm:table-cell">{u.coins}</td>
                      <td className="px-4 py-3 text-[10px] text-text-dim font-mono hidden lg:table-cell">{u.last_ip || '—'}</td>
                      <td className="px-4 py-3 text-xs text-text-dim hidden md:table-cell">{timeAgo(u.last_active)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelected(u)}
                          className="px-2.5 py-1.5 rounded-lg bg-mansion-elevated text-text-muted hover:text-mansion-gold text-xs transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => fetchUsers(page - 1, query)}
              disabled={page <= 1}
              className="p-2 rounded-lg bg-mansion-card border border-mansion-border/20 text-text-muted disabled:opacity-30 hover:text-mansion-gold transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-text-dim px-3">{page} / {pages}</span>
            <button
              onClick={() => fetchUsers(page + 1, query)}
              disabled={page >= pages}
              className="p-2 rounded-lg bg-mansion-card border border-mansion-border/20 text-text-muted disabled:opacity-30 hover:text-mansion-gold transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* User detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="bg-mansion-card rounded-2xl border border-white/10 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-mansion-border/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-mansion-elevated overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {selected.avatar_url ? (
                    <img src={selected.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-text-dim text-sm">{roleBadge(selected.role)}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{selected.username}</h3>
                  <p className="text-[11px] text-text-dim">{selected.email}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-mansion-elevated text-text-dim transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-mansion-elevated rounded-xl p-3">
                  <p className="text-text-dim text-[10px] uppercase tracking-wider mb-1">ID</p>
                  <p className="text-text-muted font-mono text-[10px] break-all">{selected.id}</p>
                </div>
                <div className="bg-mansion-elevated rounded-xl p-3">
                  <p className="text-text-dim text-[10px] uppercase tracking-wider mb-1">Rol</p>
                  <p className="text-text-primary">{selected.role} → {selected.seeking}</p>
                </div>
                <div className="bg-mansion-elevated rounded-xl p-3">
                  <p className="text-text-dim text-[10px] uppercase tracking-wider mb-1">País</p>
                  <p className="text-text-primary">{selected.country || '—'}</p>
                </div>
                <div className="bg-mansion-elevated rounded-xl p-3">
                  <p className="text-text-dim text-[10px] uppercase tracking-wider mb-1">Edad</p>
                  <p className="text-text-primary">{selected.age || '—'}</p>
                </div>
                <div className="bg-mansion-elevated rounded-xl p-3">
                  <p className="text-text-dim text-[10px] uppercase tracking-wider mb-1">Monedas</p>
                  <p className="text-mansion-gold font-bold">{selected.coins}</p>
                </div>
                <div className="bg-mansion-elevated rounded-xl p-3">
                  <p className="text-text-dim text-[10px] uppercase tracking-wider mb-1">Última IP</p>
                  <p className="text-text-muted font-mono text-[10px]">{selected.last_ip || '—'}</p>
                </div>
                <div className="bg-mansion-elevated rounded-xl p-3">
                  <p className="text-text-dim text-[10px] uppercase tracking-wider mb-1">Registro</p>
                  <p className="text-text-muted text-[10px]">{selected.created_at?.slice(0, 10)}</p>
                </div>
                <div className="bg-mansion-elevated rounded-xl p-3">
                  <p className="text-text-dim text-[10px] uppercase tracking-wider mb-1">Actividad</p>
                  <p className="text-text-muted text-[10px]">{timeAgo(selected.last_active)}</p>
                </div>
              </div>

              {/* Status badges */}
              <div className="flex flex-wrap gap-1.5">
                {selected.premium && (
                  <span className="px-2 py-1 rounded-lg bg-mansion-gold/10 border border-mansion-gold/20 text-mansion-gold text-[10px] font-semibold">
                    VIP{selected.premium_until ? ` → ${selected.premium_until.slice(0, 10)}` : ''}
                  </span>
                )}
                {selected.is_admin && (
                  <span className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-semibold">Admin</span>
                )}
                {selected.ghost_mode && (
                  <span className="px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-semibold">Ghost</span>
                )}
                {selected.verified && (
                  <span className="px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-semibold">Verificado</span>
                )}
                {selected.online && (
                  <span className="px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-semibold">Online</span>
                )}
                {selected.account_status === 'suspended' && (
                  <span className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-semibold">Suspendida</span>
                )}
                {selected.account_status === 'under_review' && (
                  <span className="px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-semibold">En revisión</span>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2 border-t border-mansion-border/20">
                <p className="text-[10px] text-text-dim uppercase tracking-wider">Acciones</p>

                {/* Toggle VIP */}
                <button
                  disabled={actionLoading}
                  onClick={() => handleAction(selected.id, {
                    premium: !selected.premium,
                    premium_until: !selected.premium ? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 19).replace('T', ' ') : null
                  })}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-mansion-elevated hover:bg-mansion-gold/10 transition-colors text-left"
                >
                  <Crown className={`w-4 h-4 ${selected.premium ? 'text-mansion-gold' : 'text-text-dim'}`} />
                  <span className="text-xs text-text-primary">{selected.premium ? 'Quitar VIP' : 'Dar VIP (30 días)'}</span>
                </button>

                {/* Toggle Admin */}
                <button
                  disabled={actionLoading}
                  onClick={() => handleAction(selected.id, { is_admin: !selected.is_admin })}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-mansion-elevated hover:bg-red-500/10 transition-colors text-left"
                >
                  <Shield className={`w-4 h-4 ${selected.is_admin ? 'text-red-400' : 'text-text-dim'}`} />
                  <span className="text-xs text-text-primary">{selected.is_admin ? 'Quitar Admin' : 'Hacer Admin'}</span>
                </button>

                {/* Add/Remove coins */}
                <div className="flex gap-2">
                  <button
                    disabled={actionLoading}
                    onClick={() => {
                      const amount = prompt('¿Cuántas monedas agregar?', '100');
                      if (amount && !isNaN(amount)) handleAction(selected.id, { coins: selected.coins + Number(amount) });
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-mansion-elevated hover:bg-mansion-gold/10 transition-colors"
                  >
                    <Coins className="w-4 h-4 text-mansion-gold" />
                    <span className="text-xs text-text-primary">+ Coins</span>
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAction(selected.id, { coins: 0 })}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-mansion-elevated hover:bg-red-500/10 transition-colors"
                  >
                    <Coins className="w-4 h-4 text-text-dim" />
                    <span className="text-xs text-text-primary">Reset Coins</span>
                  </button>
                </div>

                {/* Toggle Verified */}
                <button
                  disabled={actionLoading}
                  onClick={() => handleAction(selected.id, { verified: !selected.verified })}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-mansion-elevated hover:bg-green-500/10 transition-colors text-left"
                >
                  <UserCheck className={`w-4 h-4 ${selected.verified ? 'text-green-400' : 'text-text-dim'}`} />
                  <span className="text-xs text-text-primary">{selected.verified ? 'Quitar verificación' : 'Verificar usuario'}</span>
                </button>

                {/* Account status: Review / Suspend */}
                <div className="space-y-2 pt-2 border-t border-mansion-border/20">
                  <p className="text-[10px] text-text-dim uppercase tracking-wider">Estado de cuenta</p>

                  {/* Put under review */}
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAction(selected.id, {
                      account_status: selected.account_status === 'under_review' ? 'active' : 'under_review'
                    })}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-mansion-elevated hover:bg-yellow-500/10 transition-colors text-left"
                  >
                    <AlertTriangle className={`w-4 h-4 ${selected.account_status === 'under_review' ? 'text-yellow-400' : 'text-text-dim'}`} />
                    <span className="text-xs text-text-primary">
                      {selected.account_status === 'under_review' ? 'Quitar de revisión' : 'Poner en revisión'}
                    </span>
                  </button>

                  {/* Suspend / Reactivate */}
                  <button
                    disabled={actionLoading}
                    onClick={() => {
                      if (selected.account_status !== 'suspended') {
                        if (!confirm(`¿Suspender la cuenta de ${selected.email}?\n\nEl usuario no podrá iniciar sesión ni usar la app.`)) return;
                      }
                      handleAction(selected.id, {
                        account_status: selected.account_status === 'suspended' ? 'active' : 'suspended'
                      });
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-left ${
                      selected.account_status === 'suspended'
                        ? 'bg-green-900/20 border border-green-500/20 hover:bg-green-900/40'
                        : 'bg-orange-900/20 border border-orange-500/20 hover:bg-orange-900/40'
                    }`}
                  >
                    {selected.account_status === 'suspended' ? (
                      <><Play className="w-4 h-4 text-green-400" /><span className="text-xs text-green-400 font-semibold">Reactivar cuenta</span></>
                    ) : (
                      <><Pause className="w-4 h-4 text-orange-400" /><span className="text-xs text-orange-400 font-semibold">Suspender cuenta</span></>
                    )}
                  </button>
                </div>

                {/* Delete */}
                <button
                  disabled={actionLoading}
                  onClick={() => handleDelete(selected.id, selected.email)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-red-900/20 border border-red-500/20 hover:bg-red-900/40 transition-colors text-left"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-red-400 font-semibold">Eliminar usuario</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
