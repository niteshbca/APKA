const net = require('net');
const tls = require('tls');
const crypto = require('crypto');

/**
 * Minimal, dependency-free SMTP client (node net/tls only). Supports implicit
 * TLS (port 465) and STARTTLS (587/25), AUTH LOGIN / AUTH PLAIN and multipart
 * text+html messages encoded as base64 (so no dot-stuffing needed).
 *
 * Works with any standard provider: Gmail (app password), Zoho, Outlook,
 * Brevo/Sendinblue, Mailgun, Amazon SES, custom cPanel mail, etc.
 */

function b64(str) {
  return Buffer.from(String(str == null ? '' : str), 'utf8').toString('base64');
}

function wrap76(str) {
  return (str.match(/.{1,76}/g) || []).join('\r\n');
}

function encodeHeader(str) {
  const s = String(str == null ? '' : str);
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;
}

function formatAddress(email, name) {
  if (!name) return `<${email}>`;
  return `"${String(name).replace(/"/g, "'")}" <${email}>`;
}

/**
 * Gmail shows App Passwords as 4 space-separated groups ("abcd efgh ijkl
 * mnop"), but SMTP AUTH needs them without spaces. Users paste them with the
 * spaces, which makes Gmail reject the login. Strip whitespace for Gmail only.
 */
function cleanAppPassword(pass, host) {
  let p = String(pass == null ? '' : pass).trim();
  if (/gmail|googlemail/i.test(host || '')) p = p.replace(/\s+/g, '');
  return p;
}

function findTerminator(buf) {
  let pos = 0;
  while (true) {
    const nl = buf.indexOf('\n', pos);
    if (nl === -1) return -1;
    const line = buf.slice(pos, nl).replace(/\r$/, '');
    pos = nl + 1;
    if (/^\d{3}(?: |$)/.test(line)) return pos;
  }
}

function responseIterator(socket) {
  let buffer = '';
  return {
    async next(timeoutMs = 20000) {
      const deadline = Date.now() + timeoutMs;
      while (true) {
        const end = findTerminator(buffer);
        if (end !== -1) {
          const response = buffer.slice(0, end);
          buffer = buffer.slice(end);
          const code = parseInt(response.slice(0, 3), 10);
          return { code, text: response.trim(), response };
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error('SMTP timeout waiting for server response');
        let chunk;
        try {
          chunk = await new Promise((resolve, reject) => {
            const onData = (d) => { cleanup(); resolve(d); };
            const onErr = (e) => { cleanup(); reject(e); };
            const onEnd = () => { cleanup(); resolve(null); };
            const t = setTimeout(() => { cleanup(); reject(new Error('SMTP socket timeout')); }, remaining);
            function cleanup() {
              clearTimeout(t);
              socket.removeListener('data', onData);
              socket.removeListener('error', onErr);
              socket.removeListener('end', onEnd);
            }
            socket.once('data', onData);
            socket.once('error', onErr);
            socket.once('end', onEnd);
          });
        } catch (e) {
          throw e;
        }
        if (chunk === null) throw new Error('SMTP connection closed unexpectedly');
        buffer += chunk.toString('utf8');
      }
    },
  };
}

async function authenticate(reader, socket, user, pass) {
  socket.write('AUTH LOGIN\r\n');
  let r = await reader.next();
  if (r.code !== 334) throw new Error(`SMTP AUTH LOGIN not accepted: ${r.text}`);
  socket.write(b64(user) + '\r\n');
  r = await reader.next();
  if (r.code !== 334) throw new Error(`SMTP username rejected: ${r.text}`);
  socket.write(b64(pass) + '\r\n');
  r = await reader.next();
  if (r.code !== 235) throw new Error(`SMTP authentication failed: ${r.text}`);
}

function buildMessage({ from, fromName, to, subject, text, html, replyTo }) {
  const boundary = 'npx_' + crypto.randomBytes(12).toString('hex');
  const headers = [];
  headers.push(`From: ${formatAddress(from, fromName)}`);
  headers.push(`To: ${to}`);
  headers.push(`Subject: ${encodeHeader(subject || '')}`);
  headers.push(`Date: ${new Date().toUTCString()}`);
  headers.push(`Message-ID: <${crypto.randomUUID()}@${from.split('@')[1] || 'localhost'}>`);
  headers.push('MIME-Version: 1.0');
  if (replyTo) headers.push(`Reply-To: ${replyTo}`);
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  const parts = [];
  const plain = text || (html ? String(html).replace(/<[^>]+>/g, ' ') : '');
  parts.push(`--${boundary}`);
  parts.push('Content-Type: text/plain; charset=UTF-8');
  parts.push('Content-Transfer-Encoding: base64');
  parts.push('');
  parts.push(wrap76(b64(plain)));

  if (html) {
    parts.push(`--${boundary}`);
    parts.push('Content-Type: text/html; charset=UTF-8');
    parts.push('Content-Transfer-Encoding: base64');
    parts.push('');
    parts.push(wrap76(b64(html)));
  }
  parts.push(`--${boundary}--`);

  return headers.join('\r\n') + '\r\n\r\n' + parts.join('\r\n') + '\r\n';
}

async function sendMail(opts) {
  const {
    host,
    port = 587,
    secure = false,
    user,
    pass,
    from,
    fromName,
    to,
    subject,
    text,
    html,
    replyTo,
    timeout = 25000,
  } = opts;

  if (!host) throw new Error('SMTP host is required');
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (!recipients.length) throw new Error('Recipient email is required');
  const fromEmail = from || user;
  if (!fromEmail) throw new Error('Sender email is required');
  const cleanPass = cleanAppPassword(pass, host);

  let socket = secure
    ? tls.connect({ host, port, servername: host, rejectUnauthorized: false })
    : net.connect({ host, port });

  const cleanup = () => {
    try { socket.destroy(); } catch { /* ignore */ }
  };

  const run = async () => {
    await new Promise((resolve, reject) => {
      const onError = (e) => reject(new Error(e && (e.message || e.code) ? `SMTP connect failed: ${(e && (e.message || e.code))}` : 'SMTP connect failed'));
      socket.once(secure ? 'secureConnect' : 'connect', resolve);
      socket.once('error', onError);
      socket.on('error', () => { /* read-loop handles real errors */ });
      socket.setTimeout(timeout, () => reject(new Error('SMTP connection timeout')));
    });

    let reader = responseIterator(socket);
    let r = await reader.next();
    if (r.code !== 220) throw new Error(`SMTP not ready: ${r.text}`);

    const ehloName = (fromEmail.split('@')[1] || 'localhost').replace(/[^a-z0-9.-]/gi, '') || 'localhost';
    socket.write(`EHLO ${ehloName}\r\n`);
    r = await reader.next();
    if (r.code !== 250) throw new Error(`EHLO failed: ${r.text}`);

    if (!secure && /STARTTLS/i.test(r.text)) {
      socket.write('STARTTLS\r\n');
      r = await reader.next();
      if (r.code !== 220) throw new Error(`STARTTLS failed: ${r.text}`);
      const plainSocket = socket;
      socket = tls.connect({ socket: plainSocket, servername: host, rejectUnauthorized: false });
      await new Promise((resolve, reject) => {
        const onError = (e) => reject(new Error(e && (e.message || e.code) ? `SMTP TLS handshake failed: ${(e && (e.message || e.code))}` : 'SMTP TLS handshake failed'));
        socket.once('secureConnect', resolve);
        socket.once('error', onError);
        socket.on('error', () => { /* handled by read-loop */ });
      });
      reader = responseIterator(socket);
      socket.write(`EHLO ${ehloName}\r\n`);
      r = await reader.next();
      if (r.code !== 250) throw new Error(`EHLO (TLS) failed: ${r.text}`);
    }

    if (user && cleanPass) {
      await authenticate(reader, socket, user, cleanPass);
    }

    socket.write(`MAIL FROM:<${fromEmail}>\r\n`);
    r = await reader.next();
    if (r.code !== 250) throw new Error(`MAIL FROM rejected: ${r.text}`);

    for (const rcpt of recipients) {
      socket.write(`RCPT TO:<${rcpt}>\r\n`);
      r = await reader.next();
      if (r.code !== 250 && r.code !== 251) throw new Error(`RCPT TO <${rcpt}> rejected: ${r.text}`);
    }

    socket.write('DATA\r\n');
    r = await reader.next();
    if (r.code !== 354) throw new Error(`DATA rejected: ${r.text}`);

    const message = buildMessage({ from: fromEmail, fromName, to: recipients.join(', '), subject, text, html, replyTo });
    socket.write(message);
    socket.write('\r\n.\r\n');
    r = await reader.next();
    if (r.code !== 250) throw new Error(`Message rejected: ${r.text}`);

    socket.write('QUIT\r\n');
    try { await reader.next(3000); } catch { /* ignore */ }
  };

  let timer;
  try {
    await Promise.race([
      run(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('SMTP operation timed out')), timeout + 5000);
      }),
    ]);
    return { ok: true };
  } finally {
    clearTimeout(timer);
    cleanup();
  }
}

module.exports = { sendMail };
