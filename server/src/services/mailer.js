const net = require('net');
const tls = require('tls');
const crypto = require('crypto');

/**
 * Dependency-free mailer.
 *
 * Two transport families are supported:
 *
 *  1. SMTP (node net/tls only) — implicit TLS (465) and STARTTLS (587/25/2525),
 *     AUTH LOGIN / AUTH PLAIN, multipart text+html encoded as base64.
 *     Works with Gmail (app password), Zoho, Outlook, Brevo/Sendinblue, Mailgun,
 *     Amazon SES, custom cPanel mail, etc.
 *
 *  2. HTTP API providers — Resend, Brevo, SendGrid, Mailgun. These send over
 *     normal HTTPS (port 443) so they work even on hosts that BLOCK outbound
 *     SMTP ports (Render free tier, many office/ISP firewalls). This is the
 *     recommended fix for "SMTP connect failed: ETIMEDOUT".
 */

/* ------------------------------- SMTP helpers ------------------------------ */

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

/** Normalises a socket/connection error into a clear message (never empty). */
function connError(e, label = 'SMTP connect failed') {
  const msg = e && (e.message || e.code) ? (e.message || e.code) : '';
  return new Error(msg ? `${label}: ${msg}` : label);
}

/**
 * One SMTP attempt on an explicit port/secure combination.
 * Throws on any failure; returns { ok:true } once the server accepts the message.
 */
async function sendSmtpOnce(opts) {
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
    timeout = 20000,
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
      const onError = (e) => reject(connError(e));
      socket.once(secure ? 'secureConnect' : 'connect', resolve);
      socket.once('error', onError);
      socket.on('error', () => { /* read-loop handles real errors */ });
      socket.setTimeout(timeout, () => reject(new Error(`SMTP connection timed out after ${timeout}ms (port ${port})`)));
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
        const onError = (e) => reject(connError(e, 'SMTP TLS handshake failed'));
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
        timer = setTimeout(() => reject(new Error(`SMTP operation timed out (port ${port})`)), timeout + 5000);
      }),
    ]);
    return { ok: true, port, secure };
  } finally {
    clearTimeout(timer);
    cleanup();
  }
}

/**
 * Candidate port/secure combinations to try for an SMTP host. The configured
 * one goes first; then common alternatives (SSL 465 / STARTTLS 587 / 2525 / 25).
 * This recovers from ISPs that block one port but allow another.
 */
function smtpCandidates(host, port, secure) {
  const primary = { port: Number(port) || 587, secure: !!secure };
  const gmail = /gmail|googlemail/i.test(host || '');
  const alts = gmail
    ? [{ port: 587, secure: false }, { port: 465, secure: true }]
    : [{ port: 465, secure: true }, { port: 587, secure: false }, { port: 2525, secure: false }, { port: 25, secure: false }];
  const list = [primary];
  for (const a of alts) if (!list.some((x) => x.port === a.port && x.secure === a.secure)) list.push(a);
  return list;
}

async function sendSmtp(opts) {
  const { host, port, secure } = opts;
  const candidates = smtpCandidates(host, port, secure);
  const errors = [];
  // Each attempt gets a shortened timeout so the whole fallback stays responsive.
  const perAttempt = Math.min(Number(opts.timeout) || 20000, 10000);
  for (const c of candidates) {
    try {
      return await sendSmtpOnce({ ...opts, port: c.port, secure: c.secure, timeout: perAttempt });
    } catch (err) {
      errors.push(`port ${c.port}${c.secure ? '/SSL' : '/STARTTLS'}: ${err.message || err}`);
      // Auth/recipient/message rejections won't be fixed by another port — stop.
      if (/authentication failed|not accepted|username rejected|rejected:|Message rejected/i.test(err.message || '')) break;
    }
  }
  const detail = errors.join(' | ');
  throw new Error(
    `SMTP connect failed on all ports (${detail}). ` +
    `Your network/host is likely blocking outbound SMTP. Use an Email API provider (Resend / Brevo / SendGrid) instead — it sends over HTTPS and always works.`
  );
}

/* --------------------------- HTTP API providers ---------------------------- */

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function readJson(res) {
  const txt = await res.text().catch(() => '');
  try { return JSON.parse(txt); } catch { return txt; }
}

/**
 * Sends via an HTTPS email API. `opts.provider` selects the vendor:
 *   resend | brevo | sendgrid | mailgun
 * `opts.apiKey` is the API key/token, `opts.from`/`fromName` the sender,
 * `opts.domain` (mailgun) the verified sending domain.
 */
async function sendHttpProvider(opts) {
  const {
    provider, apiKey, from, fromName, to, subject, text, html, replyTo,
  } = opts;
  if (!apiKey) throw new Error(`${provider} API key is required`);
  if (!from) throw new Error('Sender email (From) is required');
  const recipients = (Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean));
  if (!recipients.length) throw new Error('Recipient email is required');
  const textBody = text || stripHtml(html);

  if (typeof fetch !== 'function') {
    throw new Error('This Node.js version has no fetch(); Node 18+ is required for email API providers');
  }

  let res;
  try {
    if (provider === 'resend') {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromName ? `${fromName} <${from}>` : from,
          to: recipients,
          subject,
          text: textBody,
          html: html || undefined,
          reply_to: replyTo || undefined,
        }),
      });
    } else if (provider === 'brevo') {
      res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { email: from, name: fromName || from },
          to: recipients.map((email) => ({ email })),
          subject,
          htmlContent: html || `<p>${textBody}</p>`,
          textContent: textBody,
          replyTo: replyTo ? { email: replyTo } : undefined,
        }),
      });
    } else if (provider === 'sendgrid') {
      res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: recipients.map((email) => ({ email })) }],
          from: { email: from, name: fromName || from },
          reply_to: replyTo ? { email: replyTo } : undefined,
          subject,
          content: [
            { type: 'text/plain', value: textBody || '' },
            ...(html ? [{ type: 'text/html', value: html }] : []),
          ],
        }),
      });
    } else if (provider === 'mailgun') {
      const domain = opts.domain || (from.split('@')[1] || '');
      if (!domain) throw new Error('Mailgun sending domain is required');
      const form = new URLSearchParams();
      form.set('from', fromName ? `${fromName} <${from}>` : from);
      for (const r of recipients) form.append('to', r);
      form.set('subject', subject || '');
      form.set('text', textBody || '');
      if (html) form.set('html', html);
      if (replyTo) form.set('h:Reply-To', replyTo);
      const auth = Buffer.from(`api:${apiKey}`).toString('base64');
      res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
    } else {
      throw new Error(`Unsupported email provider: ${provider}`);
    }
  } catch (e) {
    throw new Error(`${provider} request failed: ${e.message || e}`);
  }

  if (!res.ok) {
    const body = await readJson(res);
    const detail = typeof body === 'string' ? body : (body.message || body.error?.message || JSON.stringify(body));
    throw new Error(`${provider} API ${res.status}: ${detail}`);
  }
  return { ok: true, provider };
}

/* --------------------------------- dispatcher ------------------------------ */

/**
 * sendMail(opts) — the single entry point used across the app.
 *
 * opts = {
 *   provider?: 'smtp' | 'resend' | 'brevo' | 'sendgrid' | 'mailgun' (default smtp)
 *   host, port, secure, user, pass,   // SMTP
 *   apiKey, domain,                   // HTTP API providers
 *   from, fromName, to, subject, text, html, replyTo, timeout
 * }
 *
 * With provider 'smtp' it automatically retries alternative ports so a single
 * blocked port (very common) doesn't stop delivery.
 */
async function sendMail(opts = {}) {
  const provider = String(opts.provider || 'smtp').toLowerCase();
  if (provider && provider !== 'smtp') {
    return sendHttpProvider({ ...opts, provider });
  }
  return sendSmtp(opts);
}

/**
 * Quick connectivity probe for the Notifications screen. Tries each SMTP
 * candidate port and (optionally) an HTTP provider, returning per-target
 * results without sending a message.
 */
async function diagnose(opts = {}) {
  const results = [];
  const host = opts.host;
  if (host) {
    for (const c of smtpCandidates(host, opts.port, opts.secure)) {
      results.push(await probeTcp(host, c.port, c.secure));
    }
  }
  return results;
}

function probeTcp(host, port, secure, timeout = 6000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const label = `SMTP ${host}:${port}${secure ? ' (SSL)' : ' (STARTTLS)'}`;
    let done = false;
    const finish = (ok, note) => {
      if (done) return;
      done = true;
      resolve({ target: label, host, port, secure, ok, ms: Date.now() - started, note });
    };
    let socket;
    try {
      socket = secure ? tls.connect({ host, port, servername: host, rejectUnauthorized: false }) : net.connect({ host, port });
    } catch (e) {
      return finish(false, e.message);
    }
    socket.setTimeout(timeout, () => { try { socket.destroy(); } catch { /* ignore */ } finish(false, 'timed out — port likely blocked'); });
    socket.once(secure ? 'secureConnect' : 'connect', () => { finish(true, 'reachable'); try { socket.destroy(); } catch { /* ignore */ } });
    socket.once('error', (e) => finish(false, e.code || e.message || 'connection error'));
  });
}

module.exports = { sendMail, diagnose };
