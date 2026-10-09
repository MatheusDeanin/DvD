import React, { useState, useEffect, useRef } from 'react';
import {
  Hash,
  Send,
  PlusCircle,
  Smile,
  Image,
  Users,
  Search,
  Bell,
  Pin,
  AtSign,
  X
} from 'lucide-react';

const COMMON_EMOJIS = ['😀', '😂', '🔥', '🎮', '💀', '🚀', '❤️', '👀', '👍', '🤡', '⚡', '🎉', '🏆', '🍕', '😎'];

export function ChatArea({
  activeChannel,
  messages,
  onSendMessage,
  onTyping,
  typingUsers,
  currentUser,
  onToggleMembers,
  showMembers
}) {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [showAttachmentInput, setShowAttachmentInput] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e) => {
    setInputText(e.target.value);

    // Trigger typing event
    if (onTyping) {
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim() && !attachmentUrl.trim()) return;

    const attachments = attachmentUrl.trim()
      ? [{ type: 'image', url: attachmentUrl.trim() }]
      : [];

    onSendMessage(inputText.trim(), attachments);
    setInputText('');
    setAttachmentUrl('');
    setShowAttachmentInput(false);
    setShowEmojiPicker(false);
    if (onTyping) onTyping(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleAddEmoji = (emoji) => {
    setInputText((prev) => prev + emoji);
  };

  // Basic markdown parser
  const renderFormattedText = (text) => {
    if (!text) return null;

    // Detect code blocks ```code```
    const parts = text.split(/(```[\s\S]*?```|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).trim();
        return (
          <pre
            key={index}
            className="my-1.5 p-3 rounded-lg bg-discord-darkest font-mono text-xs text-emerald-400 overflow-x-auto border border-white/5"
          >
            <code>{code}</code>
          </pre>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={index}
            className="px-1.5 py-0.5 rounded bg-discord-darkest text-discord-red font-mono text-xs"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index} className="italic text-discord-text">{part.slice(1, -1)}</em>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="flex-1 bg-discord-chat flex flex-col overflow-hidden relative">
      {/* Channel Header */}
      <div className="h-12 border-b border-discord-darkest/60 px-4 flex items-center justify-between bg-discord-chat flex-shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-2 truncate">
          <Hash className="w-6 h-6 text-discord-muted flex-shrink-0" />
          <span className="font-bold text-white text-sm truncate">
            {activeChannel ? activeChannel.name : 'geral'}
          </span>
          {activeChannel?.topic && (
            <div className="hidden md:flex items-center gap-2 ml-2 pl-3 border-l border-discord-darkest/80 text-xs text-discord-muted truncate">
              {activeChannel.topic}
            </div>
          )}
        </div>

        {/* Header tools */}
        <div className="flex items-center gap-3 text-discord-muted">
          <button
            onClick={onToggleMembers}
            className={`p-1.5 rounded hover:text-white transition ${
              showMembers ? 'text-white bg-discord-hover' : ''
            }`}
            title="Lista de Membros"
          >
            <Users className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Welcome header */}
        <div className="pt-4 pb-6 border-b border-white/5">
          <div className="w-16 h-16 rounded-full bg-discord-dark flex items-center justify-center text-white mb-3 shadow">
            <Hash className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-white">
            Bem-vindo ao #{activeChannel?.name || 'geral'}!
          </h1>
          <p className="text-sm text-discord-muted mt-1">
            Este é o início do canal #{activeChannel?.name || 'geral'}. Sem censura, jogue e converse livremente com seus amigos!
          </p>
        </div>

        {/* Message items */}
        {messages.map((msg, index) => {
          const isSameSenderAsPrev =
            index > 0 && messages[index - 1].user_id === msg.user_id;

          const date = new Date(msg.created_at || Date.now());
          const timeFormatted = date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          });

          return (
            <div
              key={msg.id || index}
              className={`flex gap-3 hover:bg-black/10 -mx-4 px-4 py-1.5 rounded transition group ${
                isSameSenderAsPrev ? 'mt-0' : 'mt-2'
              }`}
            >
              {/* Avatar */}
              {!isSameSenderAsPrev ? (
                <img
                  src={
                    msg.avatar_url ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.username || 'user'}`
                  }
                  alt={msg.username}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-0.5"
                />
              ) : (
                <div className="w-10 flex-shrink-0 text-[10px] text-discord-muted opacity-0 group-hover:opacity-100 select-none text-right pr-2 pt-1">
                  {timeFormatted}
                </div>
              )}

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                {!isSameSenderAsPrev && (
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-white hover:underline cursor-pointer">
                      {msg.display_name || msg.username}
                    </span>
                    <span className="text-[11px] text-discord-muted">
                      {timeFormatted}
                    </span>
                  </div>
                )}
                <div className="text-sm text-discord-text leading-relaxed break-words whitespace-pre-wrap">
                  {renderFormattedText(msg.content)}
                </div>

                {/* Attachments (e.g. image previews) */}
                {msg.attachments &&
                  Array.isArray(msg.attachments) &&
                  msg.attachments.map((att, i) => (
                    <div key={i} className="mt-2 max-w-md rounded-lg overflow-hidden border border-white/5">
                      <img
                        src={att.url}
                        alt="Anexo"
                        className="max-h-72 rounded-lg object-contain bg-black/20"
                      />
                    </div>
                  ))}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      <div className="h-5 px-4 text-xs text-discord-muted flex items-center gap-1.5">
        {typingUsers && typingUsers.length > 0 && (
          <div className="flex items-center gap-1 animate-pulse">
            <span className="font-semibold text-white">
              {typingUsers.map((u) => u.display_name || u.username).join(', ')}
            </span>
            <span>está digitando...</span>
          </div>
        )}
      </div>

      {/* Input Box Area */}
      <div className="px-4 pb-4">
        {/* Attachment URL popover */}
        {showAttachmentInput && (
          <div className="mb-2 p-3 bg-discord-darkest rounded-lg border border-white/10 flex items-center gap-2">
            <Image className="w-4 h-4 text-discord-blurple flex-shrink-0" />
            <input
              type="text"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              placeholder="Cole a URL direta da imagem (ex: https://i.imgur.com/...)"
              className="flex-1 bg-transparent text-xs text-white focus:outline-none"
            />
            <button
              onClick={() => setShowAttachmentInput(false)}
              className="text-discord-muted hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Emoji Quick Bar */}
        {showEmojiPicker && (
          <div className="mb-2 p-2 bg-discord-darkest rounded-lg border border-white/10 flex flex-wrap gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleAddEmoji(emoji)}
                className="text-lg p-1.5 hover:bg-white/10 rounded transition"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={handleSend}
          className="bg-discord-input rounded-lg flex items-center px-4 py-2.5 gap-3 shadow-inner"
        >
          {/* Attachment Toggle */}
          <button
            type="button"
            onClick={() => setShowAttachmentInput(!showAttachmentInput)}
            className="text-discord-muted hover:text-white transition flex-shrink-0"
            title="Adicionar imagem"
          >
            <PlusCircle className="w-5 h-5" />
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Conversar em #${activeChannel?.name || 'geral'}`}
            className="flex-1 bg-transparent text-sm text-white placeholder-discord-muted focus:outline-none"
          />

          {/* Emoji Toggle */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="text-discord-muted hover:text-discord-yellow transition flex-shrink-0"
            title="Emojis"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() && !attachmentUrl.trim()}
            className="text-discord-blurple hover:text-discord-blurple-hover disabled:text-discord-muted/40 transition flex-shrink-0"
            title="Enviar"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
