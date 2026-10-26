import { getState, replaceState } from './storage.js';

const SUPABASE_URL = 'https://utbcnkukjobatouvxpdn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0YmNua3Vram9iYXRvdXZ4cGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5MjkwOTYsImV4cCI6MjEwODUwNTA5Nn0.RjgMc0Hno-Hrybg9Pp_sugIJcmgQXiBWqF55_-KDvFY';
const SYNC_CONFIG_KEY = 'workbench-sync-config';

let pushTimer = null;
let listenerAttached = false;

function readConfig() {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (!raw) return { code: '', enabled: false };
    const parsed = JSON.parse(raw);
    return { code: parsed.code || '', enabled: !!parsed.enabled };
  } catch (err) {
    return { code: '', enabled: false };
  }
}

function writeConfig(config) {
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
}

export function getSyncCode() {
  return readConfig().code;
}

export function isSyncEnabled() {
  const config = readConfig();
  return config.enabled && !!config.code;
}

async function request(path, options = {}) {
  const res = await fetch(SUPABASE_URL + path, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let message = res.statusText || '请求失败';
    try {
      const text = await res.text();
      if (text) message = text;
    } catch (err) { /* noop */ }
    throw new Error('同步失败（' + res.status + '）：' + message);
  }
  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  return contentType.includes('json') ? res.json() : null;
}

export async function pullRemote(code) {
  const syncCode = (code || getSyncCode()).trim();
  if (!syncCode) throw new Error('请先设置同步码');
  const rows = await request(
    '/rest/v1/workbench_sync?select=data,updated_at&sync_code=eq.' + encodeURIComponent(syncCode)
  );
  if (Array.isArray(rows) && rows.length && rows[0].data) {
    return rows[0].data;
  }
  return null;
}

export async function pushRemote(state, code) {
  const syncCode = (code || getSyncCode()).trim();
  if (!syncCode) throw new Error('请先设置同步码');
  await request('/rest/v1/workbench_sync?on_conflict=sync_code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      sync_code: syncCode,
      data: state,
      updated_at: new Date().toISOString(),
    }),
  });
  return true;
}

export async function enableSync(code) {
  const syncCode = (code || '').trim();
  if (!syncCode) throw new Error('请输入同步码');
  writeConfig({ code: syncCode, enabled: true });
  const remote = await pullRemote(syncCode);
  if (remote) {
    replaceState(remote);
    return 'pulled';
  }
  await pushRemote(getState(), syncCode);
  return 'pushed';
}

export function disableSync() {
  const config = readConfig();
  writeConfig({ code: config.code, enabled: false });
}

export async function pushNow() {
  await pushRemote(getState());
  return true;
}

export async function pullNow() {
  const remote = await pullRemote();
  if (!remote) throw new Error('云端暂无数据');
  replaceState(remote);
  return true;
}

function schedulePush() {
  if (!isSyncEnabled()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushNow().catch(err => console.warn('云同步自动上传失败', err));
  }, 1500);
}

function attachListener() {
  if (listenerAttached) return;
  listenerAttached = true;
  window.addEventListener('workbench:state-saved', schedulePush);
}

export async function initSync() {
  attachListener();
  if (!isSyncEnabled()) return;
  try {
    const remote = await pullRemote();
    if (remote) {
      replaceState(remote);
    } else {
      await pushRemote(getState());
    }
  } catch (err) {
    console.warn('云同步初始化失败', err);
  }
}
