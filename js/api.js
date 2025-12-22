import { converterStringParaNumero } from './utils.js';

const CONFIG = {
  WORKER_URL: 'https://gdis-custos-service.jeanmarcel-vs.workers.dev'
};

/* ======================================================
   Utils
====================================================== */

async function parseResponse(response) {
  try {
    return await response.json();
  } catch {
    const text = await response.text();
    return { erro: text };
  }
}

async function handleApiError(response, endpoint, method) {
  const body = await parseResponse(response);

  console.error(`[API] ${method} ${endpoint}`, body);

  return {
    sucesso: false,
    status: response.status,
    mensagem: body?.erro || `Erro ${response.status}`
  };
}

/* ======================================================
   Fetch autenticado
====================================================== */

async function authenticatedFetch(url, options = {}) {
  const token = localStorage.getItem('authToken');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    sessionStorage.clear();
    window.location.href = 'index.html';
    return response; // Retorna a resposta para evitar erro de promise não tratada no console
  }

  return response;
}

/* ======================================================
   SolarMarket
====================================================== */

export async function getProject(projectId) {
  const endpoint = `/solarmarket/projects/${projectId}`;
  const url = `${CONFIG.WORKER_URL}${endpoint}`;

  try {
    const response = await authenticatedFetch(url, { method: 'GET' });
    if (!response.ok) return await handleApiError(response, endpoint, 'GET');

    const json = await response.json();
    const data = json.data;

    // Garantia: campos monetários vêm como number
    for (const key in data) {
        if (data[key] && !isNaN(data[key])) {
            data[key] = converterStringParaNumero(data[key]);
        }
    }

    return { sucesso: true, dados: data };

  } catch (err) {
    return { sucesso: false, mensagem: err.message };
  }
}

export async function getProjectProposal(projectId) {
  const endpoint = `/solarmarket/projects/${projectId}/proposals`;
  const url = `${CONFIG.WORKER_URL}${endpoint}`;

  try {
    const response = await authenticatedFetch(url, { method: 'GET' });
    if (!response.ok) return await handleApiError(response, endpoint, 'GET');

    const json = await response.json();
    return { sucesso: true, dados: json.data };

  } catch (err) {
    return { sucesso: false, mensagem: err.message };
  }
}

export async function getCustomFields(projectId) {
  const endpoint = `/solarmarket/projects/${projectId}/custom-fields`;
  const url = `${CONFIG.WORKER_URL}${endpoint}`;

  try {
    const response = await authenticatedFetch(url, { method: 'GET' });
    if (!response.ok) return await handleApiError(response, endpoint, 'GET');

    const json = await response.json();
    return { sucesso: true, dados: json.data || [] };

  } catch (err) {
    return { sucesso: false, mensagem: err.message };
  }
}

export async function postCustomField(projectId, fieldId, value) {
  const endpoint = `/solarmarket/projects/${projectId}/custom-fields/${fieldId}`;
  const url = `${CONFIG.WORKER_URL}${endpoint}`;

  try {
    const response = await authenticatedFetch(url, {
      method: 'POST',
      body: JSON.stringify({ value })
    });

    if (!response.ok) return await handleApiError(response, endpoint, 'POST');

    return { sucesso: true };

  } catch (err) {
    return { sucesso: false, mensagem: err.message };
  }
}

/* ======================================================
   Auth
====================================================== */

export async function createUser(email, password) {
  const response = await fetch(`${CONFIG.WORKER_URL}/auth/create-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await parseResponse(response);
  if (!response.ok) throw new Error(data.erro || 'Erro ao criar usuário');

  return data;
}

export async function login(email, password) {
  const response = await fetch(`${CONFIG.WORKER_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await parseResponse(response);
  if (!response.ok) throw new Error(data.erro || 'Erro de login');

  localStorage.removeItem('authToken');
  localStorage.removeItem('username');
  sessionStorage.clear();

  localStorage.setItem('authToken', data.token);
  localStorage.setItem('username', email.split('@')[0]);

  return data;
}

export async function getMe() {
  const response = await authenticatedFetch(`${CONFIG.WORKER_URL}/auth/me`, {
    method: 'GET'
  });

  const data = await response.json();
  return data;
}
