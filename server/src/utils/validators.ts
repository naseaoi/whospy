export const normalizePlayerName = (value: unknown): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    throw new Error('昵称不能为空');
  }
  return trimmed.slice(0, 20);
};

export const normalizeAvatar = (value: unknown): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    throw new Error('头像不能为空');
  }
  return trimmed.slice(0, 16);
};

export const normalizeRoomId = (value: unknown): string => {
  const roomId = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{6}$/.test(roomId)) {
    throw new Error('房间号格式错误');
  }
  return roomId;
};

export const normalizePlayerToken = (value: unknown): string => {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(token)) {
    throw new Error('身份令牌无效，请刷新页面重试');
  }
  return token;
};
