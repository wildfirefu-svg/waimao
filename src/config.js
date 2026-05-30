import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

    const [key, ...rest] = trimmed.split('=');
    if (!process.env[key]) process.env[key] = rest.join('=');
  }
}

loadDotEnv(resolve('.env'));

export const config = {
  port: Number(process.env.PORT || 5173),
  databasePath: process.env.DATABASE_PATH || 'data/hengda-crm.sqlite',
  company: {
    name: process.env.COMPANY_NAME || 'Qinhuangdao Hengda Fiberglass Co., Ltd.',
    website: process.env.COMPANY_WEBSITE || 'https://www.hengdaboxian.com/',
    address: process.env.COMPANY_ADDRESS || 'No. 16 Jingbohu Road, Economic and Technological Development Zone, Qinhuangdao, Hebei, China'
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.zmail300.cn',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    user: process.env.SMTP_USER || 'sales@hengdaboxian.com',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'sales@hengdaboxian.com'
  },
  ai: {
    provider: process.env.AI_PROVIDER || '',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || ''
  }
};
