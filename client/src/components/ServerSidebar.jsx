import React from 'react';
import { Plus, MessageSquare, Activity, Compass, ShieldCheck } from 'lucide-react';

export function ServerSidebar({
  servers,
  activeServerId,
  onSelectServer,
  onOpenCreateServer,
  onOpenKeepAliveModal,
  keepAliveStatus
}) {
  return (
    <div className="w-[72px] bg-discord-darkest flex flex-col items-center py-3 select-none flex-shrink-0 z-20">
      {/* Home / Direct Messages button */}
      <div className="relative group mb-2">
        {/* Pill indicator */}
        <div
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 bg-white rounded-r transition-all duration-200 ${
            activeServerId === 'home' ? 'h-10' : 'h-0 group-hover:h-5'
          }`}
        />
        <button
          onClick={() => onSelectServer('home')}
          className={`w-12 h-12 rounded-[24px] group-hover:rounded-[16px] transition-all duration-300 flex items-center justify-center relative overflow-hidden p-1 ${
            activeServerId === 'home'
              ? 'bg-discord-blurple rounded-[16px]'
              : 'bg-discord-dark hover:bg-discord-blurple'
          }`}
          title="DvD - Mensagens Diretas"
        >
          <img
            src="/logo.jpg"
            alt="DvD"
            className="w-full h-full object-contain rounded-[14px]"
          />
        </button>
      </div>

      {/* Separator */}
      <div className="w-8 h-[2px] bg-white/10 rounded my-1" />

      {/* Servers list */}
      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center gap-2 py-1 scrollbar-none">
        {servers.map((server) => {
          const isActive = String(server.id) === String(activeServerId);
          return (
            <div key={server.id} className="relative group">
              {/* Active / Hover white pill */}
              <div
                className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 bg-white rounded-r transition-all duration-200 ${
                  isActive ? 'h-10' : 'h-0 group-hover:h-5'
                }`}
              />
              <button
                onClick={() => onSelectServer(server.id)}
                className={`w-12 h-12 rounded-[24px] group-hover:rounded-[16px] transition-all duration-200 flex items-center justify-center overflow-hidden font-bold text-sm ${
                  isActive
                    ? 'bg-discord-blurple rounded-[16px] text-white shadow-lg shadow-discord-blurple/30'
                    : 'bg-discord-dark text-discord-text hover:bg-discord-blurple hover:text-white'
                }`}
                title={server.name}
              >
                {server.icon_url ? (
                  <img
                    src={server.icon_url}
                    alt={server.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>
                    {server.name
                      .split(' ')
                      .map((w) => w[0])
                      .slice(0, 3)
                      .join('')
                      .toUpperCase()}
                  </span>
                )}
              </button>
            </div>
          );
        })}

        {/* Add Server Button */}
        <div className="relative group">
          <button
            onClick={onOpenCreateServer}
            className="w-12 h-12 rounded-[24px] group-hover:rounded-[16px] bg-discord-dark hover:bg-discord-green text-discord-green hover:text-white transition-all duration-200 flex items-center justify-center"
            title="Criar ou Entrar em um Servidor"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Render Keep-Alive & Anti-Sleep Button at bottom */}
      <div className="relative group mt-auto pt-2 border-t border-white/10 w-full flex flex-col items-center">
        <button
          onClick={onOpenKeepAliveModal}
          className="w-12 h-12 rounded-[24px] group-hover:rounded-[16px] bg-discord-dark hover:bg-emerald-600 text-emerald-400 hover:text-white transition-all duration-200 flex items-center justify-center relative shadow-sm"
          title="Anti-Sleep Render Status (24/7 Ativo)"
        >
          <Activity className="w-5 h-5 animate-pulse" />
          <span
            className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ring-2 ring-discord-darkest ${
              keepAliveStatus?.active ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
