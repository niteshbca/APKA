const crypto = require('crypto');

function genClientId(prefix = '') {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}-${id}` : id;
}

module.exports = { genClientId };
