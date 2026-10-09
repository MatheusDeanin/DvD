import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  MessageSquare,
  Check,
  X,
  Search,
  Clock,
  Sparkles,
  PhoneCall,
  UserCheck
} from 'lucide-react';

export function FriendsView({
  friends,
  onSendFriendRequest,
  onAcceptRequest,
  onRemoveFriend,
  onSelectDM,
  onStartCallWithFriend
}) {
  const [tab, setTab] = useState('online'); // 'online' | 'all' | 'pending' | 'add'
  const [searchQuery, setSearchQuery] = useState('');
  const [targetUsername, setTargetUsername] = useState('');
  const [addStatus, setAddStatus] = useState(null); // { type: 'success' | 'error', message: '' }
  const [loadingAdd, setLoadingAdd] = useState(false);

  const acceptedFriends = friends.filter((f) => f.status === 'accepted');
  const onlineFriends = acceptedFriends.filter((f) => f.user?.status_mode !== 'offline');
  const pendingIncoming = friends.filter((f) => f.status === 'pending' && f.isIncoming);
  const pendingOutgoing = friends.filter((f) => f.status === 'pending' && f.isOutgoing);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!targetUsername.trim()) return;
    setLoadingAdd(true);
    setAddStatus(null);
    try {
      await onSendFriendRequest(targetUsername.trim());
      setAddStatus({
        type: 'success',
        message: `Pedido de amizade enviado para ${targetUsername.trim()}!`
      });
      setTargetUsername('');
    } catch (err) {
      setAddStatus({
        type: 'error',
        message: err.message || 'Falha ao enviar pedido de amizade.'
      });
    } finally {
      setLoadingAdd(false);
    }
  };

  const statusColors = {
    online: 'bg-discord-green',
    idle: 'bg-discord-yellow',
    dnd: 'bg-discord-red',
    offline: 'bg-discord-muted'
  };

  const displayedFriends = (tab === 'online' ? onlineFriends : acceptedFriends).filter(
    (f) =>
      !searchQuery ||
      f.user?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.user?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 bg-discord-chat flex flex-col overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="h-12 border-b border-discord-darkest/60 px-4 flex items-center justify-between bg-discord-chat flex-shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-none py-1">
          <div className="flex items-center gap-2 font-bold text-white text-sm pr-3 border-r border-discord-darkest/80 flex-shrink-0">
            <Users className="w-5 h-5 text-discord-muted" />
            <span>Amigos</span>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setTab('online')}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${
                tab === 'online'
                  ? 'bg-discord-active text-white'
                  : 'text-discord-muted hover:bg-discord-hover hover:text-white'
              }`}
            >
              Disponível ({onlineFriends.length})
            </button>

            <button
              onClick={() => setTab('all')}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${
                tab === 'all'
                  ? 'bg-discord-active text-white'
                  : 'text-discord-muted hover:bg-discord-hover hover:text-white'
              }`}
            >
              Todos ({acceptedFriends.length})
            </button>

            <button
              onClick={() => setTab('pending')}
              className={`px-3 py-1 rounded text-xs font-semibold transition relative ${
                tab === 'pending'
                  ? 'bg-discord-active text-white'
                  : 'text-discord-muted hover:bg-discord-hover hover:text-white'
              }`}
            >
              Pendentes ({pendingIncoming.length + pendingOutgoing.length})
              {pendingIncoming.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-discord-red text-white text-[10px]">
                  {pendingIncoming.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setTab('add')}
              className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 ${
                tab === 'add'
                  ? 'bg-discord-green text-black'
                  : 'bg-discord-green/20 text-discord-green hover:bg-discord-green hover:text-black'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Adicionar Amigo
            </button>
          </div>
        </div>
      </div>

      {/* Main Content View */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* TAB: ADICIONAR AMIGO */}
        {tab === 'add' ? (
          <div className="max-w-xl">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
              Adicionar Amigo
            </h2>
            <p className="text-xs text-discord-muted mb-4">
              Você pode adicionar amigos usando o <strong>Nome de Usuário</strong> ou <strong>E-mail</strong> cadastrado deles no DvD.
            </p>

            <form
              onSubmit={handleAddSubmit}
              className="bg-discord-darkest p-3 rounded-xl border border-white/10 flex items-center gap-3 shadow-inner"
            >
              <input
                type="text"
                required
                value={targetUsername}
                onChange={(e) => setTargetUsername(e.target.value)}
                placeholder="Ex: player_dois ou amigo@email.com"
                className="flex-1 bg-transparent text-sm text-white placeholder-discord-muted focus:outline-none px-2"
              />
              <button
                type="submit"
                disabled={loadingAdd || !targetUsername.trim()}
                className="px-4 py-2 rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover font-semibold text-white text-xs transition disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
              >
                {loadingAdd ? 'Enviando...' : 'Enviar Pedido de Amizade'}
              </button>
            </form>

            {addStatus && (
              <div
                className={`mt-4 p-3 rounded-lg text-xs font-medium border flex items-center gap-2 ${
                  addStatus.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-discord-red/20 text-discord-red border-discord-red/30'
                }`}
              >
                {addStatus.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <X className="w-4 h-4 text-discord-red flex-shrink-0" />
                )}
                <span>{addStatus.message}</span>
              </div>
            )}

            <div className="mt-8 p-4 rounded-xl bg-discord-darkest/60 border border-white/5 flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-discord-yellow flex-shrink-0" />
              <div className="text-xs text-discord-text">
                <span className="font-bold text-white block mb-0.5">Dica para jogar com os 10 amigos:</span>
                Compartilhe o seu nome de usuário com eles para que todos se adicionem e conversem por Mensagens Diretas e chamadas de voz particulares!
              </div>
            </div>
          </div>
        ) : tab === 'pending' ? (
          /* TAB: PENDENTES */
          <div className="max-w-2xl space-y-6">
            {/* Incoming Requests */}
            <div>
              <h3 className="text-xs font-bold text-discord-muted uppercase tracking-wider mb-3">
                Pedidos Recebidos — {pendingIncoming.length}
              </h3>
              {pendingIncoming.length === 0 ? (
                <p className="text-xs text-discord-muted italic">Nenhum pedido de amizade pendente.</p>
              ) : (
                <div className="space-y-2">
                  {pendingIncoming.map((req) => (
                    <div
                      key={req.friendshipId}
                      className="flex items-center justify-between p-3 rounded-xl bg-discord-dark hover:bg-discord-hover transition border border-white/5"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={req.user?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.user?.username}`}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div className="truncate">
                          <span className="font-bold text-white text-sm block truncate">
                            {req.user?.display_name || req.user?.username}
                          </span>
                          <span className="text-xs text-discord-muted">
                            @{req.user?.username} • Pedido Recebido
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onAcceptRequest(req.friendshipId)}
                          className="p-2 rounded-full bg-discord-green/20 hover:bg-discord-green text-discord-green hover:text-black transition"
                          title="Aceitar Pedido"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onRemoveFriend(req.friendshipId)}
                          className="p-2 rounded-full bg-discord-red/20 hover:bg-discord-red text-discord-red hover:text-white transition"
                          title="Recusar Pedido"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outgoing Requests */}
            {pendingOutgoing.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-discord-muted uppercase tracking-wider mb-3">
                  Pedidos Enviados — {pendingOutgoing.length}
                </h3>
                <div className="space-y-2">
                  {pendingOutgoing.map((req) => (
                    <div
                      key={req.friendshipId}
                      className="flex items-center justify-between p-3 rounded-xl bg-discord-dark/50 border border-white/5"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={req.user?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.user?.username}`}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover grayscale"
                        />
                        <div className="truncate">
                          <span className="font-bold text-discord-text text-sm block truncate">
                            {req.user?.display_name || req.user?.username}
                          </span>
                          <span className="text-xs text-discord-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Aguardando resposta...
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => onRemoveFriend(req.friendshipId)}
                        className="p-2 rounded-full hover:bg-discord-red/20 text-discord-muted hover:text-discord-red transition"
                        title="Cancelar Pedido"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* TAB: ONLINE OU TODOS */
          <div className="max-w-3xl space-y-4">
            {/* Search Input */}
            <div className="relative mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar amigos..."
                className="w-full px-3 py-2 pl-9 rounded-lg bg-discord-darkest border border-white/5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-discord-blurple"
              />
              <Search className="w-4 h-4 text-discord-muted absolute left-3 top-2.5" />
            </div>

            <h3 className="text-xs font-bold text-discord-muted uppercase tracking-wider mb-2">
              {tab === 'online' ? `Disponível — ${displayedFriends.length}` : `Todos os Amigos — ${displayedFriends.length}`}
            </h3>

            {displayedFriends.length === 0 ? (
              <div className="py-12 text-center text-discord-muted space-y-2">
                <Users className="w-12 h-12 mx-auto text-discord-muted/40 mb-3" />
                <p className="text-sm font-medium">Nenhum amigo encontrado por aqui.</p>
                <p className="text-xs">
                  Clique em <strong>Adicionar Amigo</strong> para adicionar novos amigos ao seu DvD!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {displayedFriends.map((friend) => (
                  <div
                    key={friend.friendshipId}
                    className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-discord-hover transition group cursor-pointer"
                    onClick={() => onSelectDM(friend.user)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex-shrink-0">
                        <img
                          src={friend.user?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend.user?.username}`}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-discord-chat ${
                            statusColors[friend.user?.status_mode || 'offline']
                          }`}
                        />
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-sm truncate">
                            {friend.user?.display_name || friend.user?.username}
                          </span>
                          <span className="text-xs text-discord-muted opacity-0 group-hover:opacity-100 transition">
                            @{friend.user?.username}
                          </span>
                        </div>
                        <p className="text-xs text-discord-muted truncate">
                          {friend.user?.status_text || (friend.user?.status_mode !== 'offline' ? 'Online' : 'Off-line')}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDM(friend.user);
                        }}
                        className="p-2.5 rounded-full bg-discord-dark hover:bg-discord-blurple text-discord-text hover:text-white transition shadow-sm"
                        title="Enviar Mensagem Direta"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remover ${friend.user?.display_name || friend.user?.username} dos amigos?`)) {
                            onRemoveFriend(friend.friendshipId);
                          }
                        }}
                        className="p-2.5 rounded-full bg-discord-dark hover:bg-discord-red text-discord-muted hover:text-white transition shadow-sm"
                        title="Remover Amigo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
