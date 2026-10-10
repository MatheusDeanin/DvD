// Presença: um usuário está online quando possui ao menos uma conexão WebSocket autenticada.
const counts = new Map(); // userId -> nº de sockets

function add(userId) {
  const n = (counts.get(userId) || 0) + 1;
  counts.set(userId, n);
  return n;
}
function remove(userId) {
  const n = (counts.get(userId) || 0) - 1;
  if (n <= 0) {
    counts.delete(userId);
    return 0;
  }
  counts.set(userId, n);
  return n;
}
const isOnline = (userId) => (counts.get(Number(userId)) || 0) > 0;

// Status exibido aos outros: offline se não há conexão ou se o usuário escolheu "invisível".
function effectiveStatus(userId, statusMode) {
  if (!isOnline(userId)) return 'offline';
  return statusMode === 'offline' ? 'offline' : statusMode || 'online';
}

// Aplica o status efetivo a um objeto com { id, status_mode }.
function apply(user) {
  if (!user) return user;
  return { ...user, status_mode: effectiveStatus(user.id, user.status_mode) };
}

module.exports = { add, remove, isOnline, effectiveStatus, apply };
