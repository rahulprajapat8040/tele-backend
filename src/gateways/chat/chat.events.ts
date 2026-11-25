export const CHAT_EVENTS = {
  // Client -> Server
  SEND_MESSAGE: 'message:send',
  EDIT_MESSAGE: 'message:edit',
  DELETE_MESSAGE: 'message:delete',
  JOIN_CONVERSATION: 'conversation:join',
  MESSAGE_DELIVERED: 'message:delivered',
  MESSAGE_READ: 'message:read',

  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  SYNC_PENDING_MESSAGES: 'sync_pending_messages',

  // Server -> Client
  NEW_MESSAGE: 'message:new',
  MESSAGE_EDITED: 'message:edited',
  MESSAGE_DELETED: 'message:deleted',
  MESSAGE_STATUS: 'message:status',
  USER_TYPING: 'user:typing',
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',

  CONVERSATION_JOIN: 'conversation:join',
};
