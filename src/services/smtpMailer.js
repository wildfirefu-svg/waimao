import net from 'node:net';
import tls from 'node:tls';

function encodeBase64(value) {
  return Buffer.from(String(value), 'utf8').toString('base64');
}

function formatAddress(address) {
  return `<${String(address).trim().replace(/^<|>$/g, '')}>`;
}

function cleanHeader(value, fieldName) {
  const text = String(value || '');
  if (/[\r\n]/.test(text)) throw new Error(`Invalid ${fieldName} header.`);
  return text;
}

function normalizeRecipients(to) {
  return Array.isArray(to)
    ? to
    : String(to || '').split(',').map((value) => value.trim()).filter(Boolean);
}

function escapeData(body) {
  return String(body || '').replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
}

function createMessage(smtpConfig, message) {
  const to = normalizeRecipients(message.to).join(', ');
  const date = new Date().toUTCString();
  const headers = [
    `From: ${cleanHeader(smtpConfig.from, 'from')}`,
    `To: ${cleanHeader(to, 'to')}`,
    `Subject: ${cleanHeader(message.subject, 'subject')}`,
    `Date: ${date}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit'
  ];

  return `${headers.join('\r\n')}\r\n\r\n${escapeData(message.body)}\r\n.`;
}

function connect(smtpConfig) {
  const options = {
    host: smtpConfig.host,
    port: smtpConfig.port,
    servername: smtpConfig.host
  };

  return smtpConfig.secure
    ? tls.connect(options)
    : net.connect(options);
}

function createSmtpSession(socket) {
  let buffer = '';
  const waiters = [];

  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    buffer += chunk;
    flushWaiters();
  });
  socket.on('error', (error) => {
    while (waiters.length) waiters.shift().reject(error);
  });

  function flushWaiters() {
    while (waiters.length) {
      const response = readCompleteResponse();
      if (!response) return;
      waiters.shift().resolve(response);
    }
  }

  function readCompleteResponse() {
    const marker = buffer.match(/(?:^|\r\n)(\d{3}) [^\r\n]*(?:\r\n|$)/);
    if (!marker) return null;

    const end = marker.index + marker[0].length;
    const response = buffer.slice(0, end).trimEnd();
    buffer = buffer.slice(end);
    return response;
  }

  function readResponse() {
    const response = readCompleteResponse();
    if (response) return Promise.resolve(response);

    return new Promise((resolve, reject) => {
      waiters.push({ resolve, reject });
    });
  }

  function writeLine(line) {
    socket.write(`${line}\r\n`);
  }

  return { readResponse, writeLine };
}

async function expect(session, expectedCodes) {
  const response = await session.readResponse();
  const code = Number(response.slice(0, 3));
  if (!expectedCodes.includes(code)) {
    throw new Error(`SMTP command failed: ${response}`);
  }
  return response;
}

export async function sendSingleEmail(smtpConfig, message) {
  const recipients = normalizeRecipients(message.to);
  if (recipients.length === 0) throw new Error('Message recipient is required.');

  const socket = connect(smtpConfig);
  socket.setTimeout(Number(smtpConfig.timeoutMs || 15000), () => {
    socket.destroy(new Error('SMTP connection timed out.'));
  });
  const session = createSmtpSession(socket);

  try {
    await expect(session, [220]);
    session.writeLine(`EHLO ${smtpConfig.helloName || 'localhost'}`);
    await expect(session, [250]);

    if (smtpConfig.user || smtpConfig.pass) {
      session.writeLine('AUTH LOGIN');
      await expect(session, [334]);
      session.writeLine(encodeBase64(smtpConfig.user));
      await expect(session, [334]);
      session.writeLine(encodeBase64(smtpConfig.pass));
      await expect(session, [235]);
    }

    session.writeLine(`MAIL FROM:${formatAddress(smtpConfig.from)}`);
    await expect(session, [250]);
    for (const recipient of recipients) {
      session.writeLine(`RCPT TO:${formatAddress(recipient)}`);
      await expect(session, [250, 251]);
    }

    session.writeLine('DATA');
    await expect(session, [354]);
    session.writeLine(createMessage(smtpConfig, message));
    const accepted = await expect(session, [250]);

    session.writeLine('QUIT');
    await expect(session, [221]);

    return {
      accepted: recipients,
      response: accepted,
      messageId: accepted.match(/\b[0-9A-Za-z._%+-]+@[0-9A-Za-z.-]+\b/)?.[0] || ''
    };
  } finally {
    socket.end();
  }
}
