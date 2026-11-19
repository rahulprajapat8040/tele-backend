export const CHAT_EVENTS = {
  // Client -> Server
  SEND_MESSAGE: 'message:send',
  JOIN_CONVERSATION: 'conversation:join',
  MESSAGE_DELIVERED: 'message:delivered',
  MESSAGE_READ: 'message:read',

  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',

  // Server -> Client
  NEW_MESSAGE: 'message:new',
  MESSAGE_STATUS: 'message:status',
  USER_TYPING: 'user:typing',
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
};
