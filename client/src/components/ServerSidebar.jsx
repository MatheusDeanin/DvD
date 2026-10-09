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
          className={`w-12 h-12 rounded-[24px] group-hover:rounded-[16px] transition-all duration-300 flex items-center justify-center relative overflow-hidden ${
            activeServerId === 'home'
              ? 'bg-discord-blurple rounded-[16px] text-white'
              : 'bg-discord-dark text-discord-text hover:bg-discord-blurple hover:text-white'
          }`}
          title="Mensagens Diretas"
        >
          {/* Discord Clyde Logo representation */}
          <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
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
