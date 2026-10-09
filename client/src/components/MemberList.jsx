import React from 'react';
import { Crown, Shield } from 'lucide-react';

export function MemberList({ members, currentUserId }) {
  const statusColors = {
    online: 'bg-discord-green',
    idle: 'bg-discord-yellow',
    dnd: 'bg-discord-red',
    offline: 'bg-discord-muted'
  };

  const onlineMembers = members.filter((m) => m.status_mode !== 'offline');
  const offlineMembers = members.filter((m) => m.status_mode === 'offline');

  return (
    <div className="w-60 bg-discord-dark flex flex-col py-3 px-2 overflow-y-auto select-none border-l border-discord-darkest/40 flex-shrink-0">
      {/* Online Section */}
      <div className="mb-4">
        <h3 className="text-xs font-bold uppercase text-discord-muted px-2 mb-1 tracking-wider">
          Disponível — {onlineMembers.length}
        </h3>
        <div className="space-y-0.5">
          {onlineMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-discord-hover transition cursor-pointer group"
            >
              <div className="relative flex-shrink-0">
                <img
                  src={
                    member.avatar_url ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${member.username}`
                  }
                  alt={member.username}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-discord-dark ${
                    statusColors[member.status_mode] || 'bg-discord-green'
                  }`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-discord-text group-hover:text-white truncate">
                    {member.display_name || member.username}
                  </span>
                  {member.role === 'owner' && (
                    <Crown className="w-3.5 h-3.5 text-discord-yellow flex-shrink-0" title="Dono do Servidor" />
                  )}
                </div>
                {member.status_text && (
                  <p className="text-[11px] text-discord-muted truncate">
                    {member.status_text}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Offline Section */}
      {offlineMembers.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase text-discord-muted px-2 mb-1 tracking-wider">
            Off-line — {offlineMembers.length}
          </h3>
          <div className="space-y-0.5">
            {offlineMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-discord-hover transition opacity-60 hover:opacity-100 cursor-pointer group"
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={
                      member.avatar_url ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${member.username}`
                    }
                    alt={member.username}
                    className="w-8 h-8 rounded-full object-cover grayscale"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-discord-dark bg-discord-muted" />
                </div>

                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-discord-muted group-hover:text-white truncate block">
                    {member.display_name || member.username}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
