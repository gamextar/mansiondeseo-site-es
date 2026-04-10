import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Crown, Shield, Trash2, ChevronLeft, ChevronRight, Eye, X, Coins, UserCheck, AlertTriangle, Pause, Play, Film, Pencil } from 'lucide-react';
import { adminGetUsers, adminGetUserIds, adminGetUser, adminUpdateUser, adminDeleteUser, adminBulkDeleteUsers, adminUploadStoryForUser, adminDeleteStory } from '../../lib/api';
import AvatarImg from '../../components/AvatarImg';
import { resolveMediaUrl } from '../../lib/media';

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
  const map = {
    hombre: '♂',
    mujer: '♀',
    pareja: '♂♀',
    pareja_hombres: '♂♂',
    pareja_mujeres: '♀♀',
    trans: '⚧',
  };
  return map[role] || role;
}

function roleLabel(role) {
  const map = {
    hombre: 'Hombres',
    mujer: 'Mujeres',
    pareja: 'Parejas',
    pareja_hombres: 'Pareja de Hombres',
    pareja_mujeres: 'Pareja de Mujeres',
    trans: 'Trans',
  };
  return map[role] || role;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [query, setQuery] = useState('');
  const [fakeFilter, setFakeFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [storyUploading, setStoryUploading] = useState(false);
  const [storyCaption, setStoryCaption] = useState('');
  const [galleryEditing, setGalleryEditing] = useState(false);
  const [gallerySaving, setGallerySaving] = useState(false);
  const storyInputRef = useRef(null);
  const galleryDragItem = useRef(null);
  const galleryDragOverItem = useRef(null);

  const fetchUsers = useCallback(async (p = page, q = query, fake = fakeFilter, role = roleFilter, status = statusFilter) => {
    setLoading(true);
    try {
      const data = await adminGetUsers({
        page: p,
        limit: 20,
        q,
        fake: fake === 'all' ? '' : fake,
        role: role === 'all' ? '' : role,
        status: status === 'all' ? '' : status,
      });
      setUsers(data.users);
      setTotal(data.total);
      setPage(data.page);
      setPages(data.pages);
      setSelectedIds([]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, query, fakeFilter, roleFilter, statusFilter]);

  useEffect(() => { fetchUsers(1, query, fakeFilter, roleFilter, statusFilter); }, [query, fakeFilter, roleFilter, statusFilter]); // eslint-disable-line

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(searchInput);
  };

  const handleSelectVisibleFakes = () => {
    const visibleFakeIds = users.filter((u) => u.fake).map((u) => u.id);
    setSelectedIds((prev) => [...new Set([...prev, ...visibleFakeIds])]);
  };

  const handleSelectMatchingFakes = async () => {
    setSelectionLoading(true);
    try {
      const data = await adminGetUserIds({
        q: query,
        fake: '1',
        role: roleFilter === 'all' ? '' : roleFilter,
      });
      setSelectedIds(data.ids || []);
    } catch (err) {
      alert(err.message || 'Error al seleccionar usuarios fake');
    } finally {
      setSelectionLoading(false);
    }
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

  const openUserModal = useCallback(async (user) => {
    setSelected({ ...user, photos: Array.isArray(user.photos) ? user.photos : [] });
    setSelectedLoading(true);
    setGalleryEditing(false);
    setStoryCaption('');
    try {
      const data = await adminGetUser(user.id);
      setSelected(data.user);
    } catch (err) {
      alert(err.message || 'Error al cargar el detalle del usuario');
    } finally {
      setSelectedLoading(false);
    }
  }, []);

  const closeUserModal = useCallback(() => {
    setSelected(null);
    setSelectedLoading(false);
    setGalleryEditing(false);
    setGallerySaving(false);
    setStoryCaption('');
    galleryDragItem.current = null;
    galleryDragOverItem.current = null;
  }, []);

  const persistGalleryPhotos = useCallback(async (nextPhotos) => {
    if (!selected?.id) return;
    const userId = selected.id;
    const previousPhotos = Array.isArray(selected.photos) ? selected.photos : [];
    setGallerySaving(true);
    setSelected((prev) => (prev && prev.id === userId ? { ...prev, photos: nextPhotos } : prev));
    try {
      const data = await adminUpdateUser(userId, { photos: nextPhotos });
      setSelected((prev) => (prev && prev.id === userId ? { ...prev, ...data.user } : prev));
    } catch (err) {
      setSelected((prev) => (prev && prev.id === userId ? { ...prev, photos: previousPhotos } : prev));
      alert(err.message || 'Error al guardar la galería');
    } finally {
      setGallerySaving(false);
    }
  }, [selected]);

  const handleGalleryDragStart = useCallback((index, event) => {
    galleryDragItem.current = index;
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleGalleryDragOver = useCallback((index, event) => {
    event.preventDefault();
    galleryDragOverItem.current = index;
  }, []);

  const handleGalleryDrop = useCallback((event) => {
    event.preventDefault();
    const from = galleryDragItem.current;
    const to = galleryDragOverItem.current;
    galleryDragItem.current = null;
    galleryDragOverItem.current = null;
    if (from === null || to === null || from === to || !Array.isArray(selected?.photos)) return;
    const next = [...selected.photos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistGalleryPhotos(next);
  }, [persistGalleryPhotos, selected]);

  const handleGalleryDeletePhoto = useCallback((url) => {
    if (!Array.isArray(selected?.photos)) return;
    const next = selected.photos.filter((photo) => photo !== url);
    persistGalleryPhotos(next);
  }, [persistGalleryPhotos, selected]);

  const handleUsePhotoAsAvatar = useCallback(async (url) => {
    if (!selected?.id || !Array.isArray(selected.photos) || selected.avatar_url === url) return;
    const previousAvatar = selected.avatar_url || '';
    const basePhotos = selected.photos.filter((photo) => photo !== url);
    const nextPhotos = previousAvatar && previousAvatar !== url && !basePhotos.includes(previousAvatar)
      ? [previousAvatar, ...basePhotos]
      : basePhotos;

    setGallerySaving(true);
    try {
      const data = await adminUpdateUser(selected.id, {
        avatar_url: url,
        avatar_crop: null,
        photos: nextPhotos,
      });
      setSelected((prev) => (prev && prev.id === selected.id ? { ...prev, ...data.user } : prev));
      setUsers((prev) => prev.map((user) => (
        user.id === selected.id
          ? { ...user, avatar_url: data.user.avatar_url, avatar_crop: data.user.avatar_crop, photos: data.user.photos }
          : user
      )));
    } catch (err) {
      alert(err.message || 'Error al actualizar el avatar');
    } finally {
      setGallerySaving(false);
    }
  }, [selected]);

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

  const toggleSelectedId = (userId) => {
    setSelectedIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const toggleSelectAllCurrentPage = () => {
    const currentPageIds = users.map((u) => u.id);
    setSelectedIds((prev) => {
      const allSelected = currentPageIds.length > 0 && currentPageIds.every((id) => prev.includes(id));
      return allSelected
        ? prev.filter((id) => !currentPageIds.includes(id))
        : [...new Set([...prev, ...currentPageIds])];
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`¿Eliminar PERMANENTEMENTE ${selectedIds.length} usuarios?\n\nEsto borrará también su media en R2, mensajes, favoritos, visitas, gifts y stories.`)) return;
    setActionLoading(true);
    try {
      const result = await adminBulkDeleteUsers(selectedIds);
      const deletedIds = (result.results || []).filter((item) => item.deleted).map((item) => item.user_id);
      const failed = (result.results || []).filter((item) => !item.deleted);
      setUsers(prev => prev.filter((u) => !deletedIds.includes(u.id)));
      setSelectedIds(prev => prev.filter((id) => !deletedIds.includes(id)));
      setTotal(t => Math.max(0, t - deletedIds.length));
      if (selected && deletedIds.includes(selected.id)) setSelected(null);
      if (failed.length > 0) {
        alert(`Se eliminaron ${deletedIds.length} usuarios. ${failed.length} no se pudieron borrar o se saltaron.`);
      }
    } catch (err) {
      alert(err.message || 'Error al borrar usuarios');
    } finally {
      setActionLoading(false);
    }
  };

  const allCurrentPageSelected = users.length > 0 && users.every((u) => selectedIds.includes(u.id));

  const handleStoryUpload = async (e) => {
    const file = e.target.files?.[0];
    if (storyInputRef.current) storyInputRef.current.value = '';
    if (!file || !selected) return;
    setStoryUploading(true);
    try {
      const result = await adminUploadStoryForUser(selected.id, file, { caption: storyCaption });
      setSelected(s => ({ ...s, story_id: result.id }));
      setUsers(prev => prev.map(u => u.id === selected.id ? { ...u, story_id: result.id } : u));
      setStoryCaption('');
    } catch (err) {
      alert(err.message || 'Error al subir historia');
    } finally {
      setStoryUploading(false);
    }
  };

  const handleStoryDelete = async () => {
    if (!selected?.story_id) return;
    if (!confirm(`¿Eliminar la historia de ${selected.username}? Esta acción no se puede deshacer.`)) return;
    setActionLoading(true);
    try {
      await adminDeleteStory(selected.story_id);
      setSelected(s => ({ ...s, story_id: null }));
      setUsers(prev => prev.map(u => u.id === selected.id ? { ...u, story_id: null } : u));
    } catch (err) {
      alert(err.message || 'Error al eliminar historia');
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

        {selectedIds.length > 0 && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-900/10 px-4 py-3">
            <p className="text-sm text-red-300">
              {selectedIds.length} usuario{selectedIds.length === 1 ? '' : 's'} seleccionado{selectedIds.length === 1 ? '' : 's'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="px-3 py-2 rounded-xl bg-mansion-elevated text-text-dim hover:text-text-primary text-xs transition-colors"
              >
                Limpiar selección
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleBulkDelete}
                className="px-3 py-2 rounded-xl bg-red-900/30 border border-red-500/20 text-red-300 hover:bg-red-900/40 text-xs font-semibold transition-colors disabled:opacity-60"
              >
                {actionLoading ? 'Borrando...' : 'Borrar seleccionados'}
              </button>
            </div>
          </div>
        )}

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

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'Todos' },
            { id: '1', label: 'Solo fake' },
            { id: '0', label: 'Solo reales' },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFakeFilter(option.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                fakeFilter === option.id
                  ? 'bg-mansion-gold/10 border-mansion-gold/30 text-mansion-gold'
                  : 'bg-mansion-card border-mansion-border/20 text-text-dim hover:text-text-primary'
              }`}
            >
              {option.label}
            </button>
          ))}

          {[
            { id: 'all', label: 'Todos los roles' },
            { id: 'mujer', label: 'Mujeres' },
            { id: 'hombre', label: 'Hombres' },
            { id: 'pareja', label: 'Parejas' },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setRoleFilter(option.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                roleFilter === option.id
                  ? 'bg-mansion-gold/10 border-mansion-gold/30 text-mansion-gold'
                  : 'bg-mansion-card border-mansion-border/20 text-text-dim hover:text-text-primary'
              }`}
            >
              {option.label}
            </button>
          ))}

          {[
            { id: 'all', label: 'Todos los estados' },
            { id: 'under_review', label: '⚠️ En revisión' },
            { id: 'suspended', label: '🚫 Suspendidos' },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setStatusFilter(option.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                statusFilter === option.id
                  ? 'bg-mansion-gold/10 border-mansion-gold/30 text-mansion-gold'
                  : 'bg-mansion-card border-mansion-border/20 text-text-dim hover:text-text-primary'
              }`}
            >
              {option.label}
            </button>
          ))}

          <button
            type="button"
            onClick={handleSelectVisibleFakes}
            className="px-3 py-2 rounded-xl bg-mansion-card border border-mansion-border/20 text-text-dim hover:text-mansion-gold text-xs font-semibold transition-colors"
          >
            Seleccionar fake visibles
          </button>

              <button
                type="button"
                disabled={selectionLoading}
                onClick={handleSelectMatchingFakes}
                className="px-3 py-2 rounded-xl bg-mansion-card border border-mansion-border/20 text-text-dim hover:text-mansion-gold text-xs font-semibold transition-colors disabled:opacity-60"
          >
            {selectionLoading ? 'Seleccionando...' : 'Seleccionar fake del resultado'}
          </button>
        </div>

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
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allCurrentPageSelected}
                        onChange={toggleSelectAllCurrentPage}
                        className="accent-mansion-gold"
                        aria-label="Seleccionar todos los usuarios de la página"
                      />
                    </th>
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
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(u.id)}
                          onChange={() => toggleSelectedId(u.id)}
                          className="accent-mansion-gold"
                          aria-label={`Seleccionar ${u.username}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-mansion-elevated overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {u.avatar_url ? (
                              <AvatarImg src={u.avatar_url} crop={u.avatar_crop} alt="" className="w-full h-full" />
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
                          onClick={() => openUserModal(u)}
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
              onClick={() => fetchUsers(page - 1, query, fakeFilter, roleFilter, statusFilter)}
              disabled={page <= 1}
              className="p-2 rounded-lg bg-mansion-card border border-mansion-border/20 text-text-muted disabled:opacity-30 hover:text-mansion-gold transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-text-dim px-3">{page} / {pages}</span>
            <button
              onClick={() => fetchUsers(page + 1, query, fakeFilter, roleFilter, statusFilter)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={closeUserModal}>
          <div className="bg-mansion-card rounded-2xl border border-white/10 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-mansion-border/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-mansion-elevated overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {selected.avatar_url ? (
                    <AvatarImg src={selected.avatar_url} crop={selected.avatar_crop} alt="" className="w-full h-full" />
                  ) : (
                    <span className="text-text-dim text-sm">{roleBadge(selected.role)}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{selected.username}</h3>
                  <p className="text-[11px] text-text-dim">{selected.email}</p>
                </div>
              </div>
              <button onClick={closeUserModal} className="p-2 rounded-lg hover:bg-mansion-elevated text-text-dim transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info */}
            <div className="p-4 space-y-3">
              {selectedLoading ? (
                <div className="rounded-2xl border border-mansion-border/20 bg-mansion-elevated/40 p-8 text-center text-sm text-text-dim">
                  Cargando detalle del usuario...
                </div>
              ) : (
                <>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-mansion-elevated rounded-xl p-3">
                  <p className="text-text-dim text-[10px] uppercase tracking-wider mb-1">ID</p>
                  <p className="text-text-muted font-mono text-[10px] break-all">{selected.id}</p>
                </div>
                <div className="bg-mansion-elevated rounded-xl p-3">
                  <p className="text-text-dim text-[10px] uppercase tracking-wider mb-1">Rol</p>
                  <p className="text-text-primary">{selected.role} → {selected.seeking}</p>
                </div>
                <div className="bg-mansion-elevated rounded-xl p-3 col-span-2">
                  <p className="text-text-dim text-[10px] uppercase tracking-wider mb-1">Bloqueo de mensajes</p>
                  {Array.isArray(selected.message_block_roles) && selected.message_block_roles.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selected.message_block_roles.map((role) => (
                        <span
                          key={role}
                          className="px-2 py-1 rounded-lg bg-mansion-gold/10 border border-mansion-gold/20 text-mansion-gold text-[10px] font-semibold"
                        >
                          {roleLabel(role)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-text-primary">Acepta mensajes de todos</p>
                  )}
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

                <div className="space-y-3 pt-2 border-t border-mansion-border/20">
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] text-text-dim uppercase tracking-wider">Avatar</p>
                      <p className="text-[11px] text-text-dim mt-1">Se muestra aparte y no forma parte del orden de la galería.</p>
                    </div>
                    <div className="w-24">
                      <div className="aspect-square rounded-2xl overflow-hidden border border-mansion-border/20 bg-mansion-elevated">
                        {selected.avatar_url ? (
                          <AvatarImg
                            src={selected.avatar_url}
                            crop={selected.avatar_crop}
                            alt={`Avatar de ${selected.username}`}
                            className="w-full h-full"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl text-text-dim">
                            {roleBadge(selected.role)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-text-dim uppercase tracking-wider">Galería</p>
                      <p className="text-[11px] text-text-dim mt-1">
                        {Array.isArray(selected.photos) ? selected.photos.length : 0} foto{selected.photos?.length === 1 ? '' : 's'}
                        {galleryEditing ? ' · Arrastra para reordenar' : ''}
                      </p>
                    </div>
                    {Array.isArray(selected.photos) && selected.photos.length > 0 && (
                      <button
                        type="button"
                        disabled={gallerySaving}
                        onClick={() => setGalleryEditing((prev) => !prev)}
                        className={`flex items-center gap-1 text-xs transition-colors ${
                          galleryEditing
                            ? 'text-mansion-gold hover:text-mansion-gold-light'
                            : 'text-text-dim hover:text-text-primary'
                        } disabled:opacity-60`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {galleryEditing ? (gallerySaving ? 'Guardando...' : 'Listo') : 'Editar'}
                      </button>
                    )}
                  </div>

                  {Array.isArray(selected.photos) && selected.photos.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                      {selected.photos.map((url, index) => (
                        <div
                          key={`${url}-${index}`}
                          draggable={galleryEditing && selected.photos.length > 1 && !gallerySaving}
                          onDragStart={galleryEditing ? (event) => handleGalleryDragStart(index, event) : undefined}
                          onDragOver={galleryEditing ? (event) => handleGalleryDragOver(index, event) : undefined}
                          onDrop={galleryEditing ? handleGalleryDrop : undefined}
                          className={`group relative aspect-square rounded-2xl overflow-hidden border border-mansion-border/20 bg-mansion-elevated ${
                            galleryEditing ? 'cursor-grab active:cursor-grabbing' : ''
                          }`}
                        >
                          <img
                            src={resolveMediaUrl(url)}
                            alt={`Foto ${index + 1}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                            <span className="text-[10px] font-semibold text-white/90">#{index + 1}</span>
                            {galleryEditing && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={gallerySaving || selected.avatar_url === url}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    handleUsePhotoAsAvatar(url);
                                  }}
                                  className={`rounded-full px-2 py-1 text-[10px] font-semibold transition-colors disabled:opacity-60 ${
                                    selected.avatar_url === url
                                      ? 'bg-mansion-gold/70 text-black'
                                      : 'bg-black/60 text-white hover:bg-mansion-gold hover:text-black'
                                  }`}
                                >
                                  {selected.avatar_url === url ? 'Avatar' : 'Usar'}
                                </button>
                                <button
                                  type="button"
                                  disabled={gallerySaving}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    handleGalleryDeletePhoto(url);
                                  }}
                                  className="inline-flex items-center justify-center rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-red-500/80 disabled:opacity-60"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-mansion-border/20 bg-mansion-elevated/30 px-4 py-6 text-center text-sm text-text-dim">
                      Este usuario no tiene fotos en su galería.
                    </div>
                  )}
                </div>

                {/* Upload / Delete story */}
                <div className="space-y-2 pt-2 border-t border-mansion-border/20">
                  <p className="text-[10px] text-text-dim uppercase tracking-wider">Historias</p>
                  {selected.story_id ? (
                    <button
                      disabled={actionLoading}
                      onClick={handleStoryDelete}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-red-900/20 border border-red-500/20 hover:bg-red-900/40 transition-colors text-left"
                    >
                      <Film className="w-4 h-4 text-red-400" />
                      <span className="text-xs text-red-400 font-semibold">{actionLoading ? 'Eliminando...' : 'Eliminar historia'}</span>
                    </button>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={storyCaption}
                        onChange={e => setStoryCaption(e.target.value)}
                        placeholder="Texto de la historia (opcional)..."
                        className="w-full px-4 py-2 rounded-xl bg-mansion-elevated border border-mansion-border/20 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-mansion-gold/40"
                      />
                      <button
                        disabled={storyUploading}
                        onClick={() => storyInputRef.current?.click()}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-mansion-elevated hover:bg-mansion-crimson/10 transition-colors text-left"
                      >
                        <Film className={`w-4 h-4 ${storyUploading ? 'text-text-dim animate-pulse' : 'text-mansion-crimson'}`} />
                        <span className="text-xs text-text-primary">{storyUploading ? 'Subiendo historia...' : 'Subir historia para este usuario'}</span>
                      </button>
                    </>
                  )}
                  <input
                    ref={storyInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleStoryUpload}
                  />
                </div>
              </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
