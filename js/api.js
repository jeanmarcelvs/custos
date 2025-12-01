import { converterStringParaNumero } from './utils.js';

const WORKER_URL = 'https://gdis-custos-service.jeanmarcel-vs.workers.dev';

/**
 * Manipulador de erro padrão para chamadas de API.
 * @param {Response} response - O objeto de resposta da API.
 * @param {string} endpoint - O endpoint que foi chamado.
 * @param {string} method - O método HTTP usado (GET, POST, etc.).
 * @returns {{sucesso: false, dados: null, mensagem: string}}
 */
async function handleApiError(response, endpoint, method) {
    const errorBody = await response.text();
    console.error(`[API] Erro ${method} em ${endpoint}:`, errorBody);
    return { sucesso: false, dados: null, mensagem: `Erro ${response.status} (${response.statusText})` };
}

/**
 * Função genérica para realizar uma chamada GET.
 * @param {string} endpoint - O caminho do endpoint da API (ex: '/users').
 * @returns {Promise<{sucesso: boolean, dados: any | null, mensagem?: string}>}
 */
export async function get(endpoint) {
    try {
        const fullUrl = `${WORKER_URL}/solarmarket${endpoint}`;
        console.log('[GET]', fullUrl);

        const response = await fetch(fullUrl);
        if (!response.ok) return await handleApiError(response, endpoint, 'GET');

        const dados = await response.json();
        return { sucesso: true, dados };

    } catch (error) {
        console.error('[API] Erro em GET genérico:', error);
        return { sucesso: false, dados: null };
    }
}

/**
 * Busca os dados principais de um projeto específico.
 * @param {string | number} projectId - O ID do projeto.
 * @returns {Promise<{sucesso: boolean, dados: object | null, mensagem?: string}>}
 */
export async function getProject(projectId) {
    const endpoint = `/solarmarket/projects/${projectId}`;
    const fullUrl = `${WORKER_URL}${endpoint}`;

    try {
        const response = await fetch(fullUrl);

        if (!response.ok) return await handleApiError(response, endpoint, 'GET');

        const { data } = await response.json();

        // Garantia: campos monetários vêm como number
        for (const key in data) {
            if (data[key] && !isNaN(data[key])) {
                data[key] = converterStringParaNumero(data[key]);
            }
        }

        return { sucesso: true, dados: data };

    } catch (error) {
        console.error('[API] Erro em getProject:', error);
        return { sucesso: false, dados: null };
    }
}

/**
 * Busca os dados da proposta ativa de um projeto.
 * @param {string | number} projectId - O ID do projeto.
 * @returns {Promise<{sucesso: boolean, dados: object | null, mensagem?: string}>}
 */
export async function getProjectProposal(projectId) {
    const endpoint = `/solarmarket/projects/${projectId}/proposals`;
    const fullUrl = `${WORKER_URL}${endpoint}`;

    try {
        const response = await fetch(fullUrl);

        if (!response.ok) return await handleApiError(response, endpoint, 'GET');

        const dados = await response.json();

        return { sucesso: true, dados: dados.data };

    } catch (error) {
        console.error('[API] Erro em getProjectProposal:', error);
        return { sucesso: false, dados: null };
    }
}

/**
 * Busca todos os campos customizados de um projeto.
 * @param {string | number} projectId - O ID do projeto.
 * @returns {Promise<{sucesso: boolean, dados: any[] | null, mensagem?: string}>}
 */
export async function getCustomFields(projectId) {
    const endpoint = `/solarmarket/projects/${projectId}/custom-fields`;
    const fullUrl = `${WORKER_URL}${endpoint}`;

    try {
        const response = await fetch(fullUrl);

        if (!response.ok) return await handleApiError(response, endpoint, 'GET');

        const dados = await response.json();

        // Garantia: normaliza campos text/textarea com separador | se necessário
        if (dados.data && Array.isArray(dados.data)) {
            dados.data.forEach(item => {
                if (item.value && typeof item.value === 'string') {
                    item.value = item.value.trim();
                } else if (!item.value) {
                    item.value = '';
                }
            });
        }

        return { sucesso: true, dados: dados.data };

    } catch (error) {
        console.error('[API] Erro em getCustomFields:', error);
        return { sucesso: false, dados: null };
    }
}

/**
 * Atualiza o valor de um campo customizado específico.
 * @param {string | number} projectId - O ID do projeto.
 * @param {number} fieldId - O ID do campo customizado.
 * @param {string | number} value - O novo valor para o campo.
 * @returns {Promise<{sucesso: boolean, dados: any | null}>}
 */
export async function postCustomField(projectId, fieldId, value) {
    try {
        const url = `${WORKER_URL}/solarmarket/projects/${projectId}/custom-fields/${fieldId}`;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value })
        });

        const json = await response.json().catch(() => null);

        return { sucesso: response.ok, dados: json };
    } catch (error) {
        console.error(`[API] Erro em postCustomField para o campo ${fieldId}:`, error);
        throw error;
    }
}

/**
 * Formata um valor antes de enviá-lo para a API, com base no tipo do campo.
 * @param {any} valor - O valor a ser formatado.
 * @param {string} [tipo='text'] - O tipo do campo ('text', 'textarea', 'money').
 * @returns {string | number}
 */
export function formatarValorParaEnvio(valor, tipo = 'text') {
    if (tipo === 'money') return converterStringParaNumero(valor);
    if (tipo === 'textarea' || tipo === 'text') return valor ? valor.trim() : '';
    return valor;
}

/**
 * Cria um novo usuário.
 * @param {string} email - O e-mail do usuário.
 * @param {string} password - A senha do usuário.
 * @returns {Promise<any>}
 */
export async function createUser(email, password) {
    const response = await fetch(`${WORKER_URL}/auth/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });
    return response.json();
}

/**
 * Realiza o login do usuário.
 * @param {string} email - O e-mail do usuário.
 * @param {string} password - A senha do usuário.
 * @returns {Promise<any>}
 */
export async function login(email, password) {
    const response = await fetch(`${WORKER_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });
    return response.json();
}

/**
 * Busca os dados do usuário autenticado usando o token do localStorage.
 * @returns {Promise<any>}
 */
export async function getMe() {
    const token = localStorage.getItem('authToken');
    if (!token) return { sucesso: false, user: null };

    const response = await fetch(`${WORKER_URL}/auth/me`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    });
    return response.json();
}
