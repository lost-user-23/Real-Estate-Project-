const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { handleTurn, startConversation, MAX_MESSAGE_LENGTH } = require('../services/assistant/conversation');

// Upper bound on the conversation state a client may send back. Real state is
// well under 2 KB; this only stops padded requests before they are parsed.
const MAX_STATE_BYTES = 8 * 1024;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const chat = asyncHandler(async (req, res) => {
  const body = isPlainObject(req.body) ? req.body : {};
  const errors = [];

  if (body.message !== undefined && typeof body.message !== 'string') errors.push('message must be a string');
  else if (typeof body.message === 'string' && body.message.length > MAX_MESSAGE_LENGTH) {
    errors.push(`message must be at most ${MAX_MESSAGE_LENGTH} characters`);
  }
  if (body.action !== undefined && !isPlainObject(body.action)) errors.push('action must be an object');
  if (body.state !== undefined && !isPlainObject(body.state)) errors.push('state must be an object');
  else if (body.state !== undefined && Buffer.byteLength(JSON.stringify(body.state)) > MAX_STATE_BYTES) {
    errors.push('state is too large');
  }
  if (errors.length > 0) throw AppError.badRequest('Validation failed', errors);

  const isStart = body.message === undefined && body.action === undefined && body.state === undefined;
  const reply = isStart ? await startConversation() : await handleTurn({ message: body.message, action: body.action, state: body.state });
  res.status(200).json(reply);
});

module.exports = { chat };
