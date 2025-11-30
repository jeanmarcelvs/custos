// =======================================
// api.js — versão final compatível produção
// =======================================

import { SEPARADOR, formatarLinhaSeparador, converterStringParaNumero } from './utils.js';

const WORKER_URL = 'https://gdis-api-service.jeanmarcel-vs.workers.dev';

/**
 * Tratamento de erro padrão
 */
async function handleApiError(response, endpoint, method) {
    const errorBody = await response.text();
    console.error(`Erro ${method} em ${endpoint}:`, errorBody);
    return { sucesso: false, dados: null, mensagem: `Erro ${response.status} (${response.statusText})` };
}

// =================================================
// GET padrão (raramente usado)
// =================================================
export async function get(endpoint) {
    try {
        const fullUrl = `${WORKER_URL}/solarmarket${endpoint}`;
        console.log('[GET]', fullUrl);

        const response = await fetch(fullUrl);
        if (!response.ok) return await handleApiError(response, endpoint, 'GET');

        const dados = await response.json();
        return { sucesso: true, dados };

    } catch (err) {
        console.error('[GET] Erro:', err);
        return { sucesso: false, dados: null };
    }
}

// =================================================
// GET PROJECT — busca dados principais do projeto
// =================================================
export async function getProject(projectId) {
    const endpoint = `/solarmarket/projects/${projectId}`;
    const fullUrl = `${WORKER_URL}${endpoint}`;

    try {
        console.log('[GET PROJECT] →', fullUrl);
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

    } catch (err) {
        console.error('[GET PROJECT] Erro:', err);
        return { sucesso: false, dados: null };
    }
}

// =================================================
// GET PROPOSAL — busca dados da proposta ativa
// =================================================
export async function getProjectProposal(projectId) {
    const endpoint = `/solarmarket/projects/${projectId}/proposals`;
    const fullUrl = `${WORKER_URL}${endpoint}`;

    console.log('[GET PROPOSAL] →', fullUrl);

    try {
        const response = await fetch(fullUrl);

        if (!response.ok) return await handleApiError(response, endpoint, 'GET');

        const dados = await response.json();

        return { sucesso: true, dados: dados.data };

    } catch (err) {
        console.error('[GET PROPOSAL] Erro:', err);
        return { sucesso: false, dados: null };
    }
}

// =================================================
// GET CUSTOM FIELDS
// =================================================
export async function getCustomFields(projectId) {
    const endpoint = `/solarmarket/projects/${projectId}/custom-fields`;
    const fullUrl = `${WORKER_URL}${endpoint}`;

    console.log('[GET CUSTOM FIELDS] →', fullUrl);

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

    } catch (err) {
        console.error('[GET CUSTOM FIELDS] Erro:', err);
        return { sucesso: false, dados: null };
    }
}

// =================================================
// POST CUSTOM FIELD (update)
// =================================================
export async function postCustomField(projectId, fieldId, value) {
    console.group(`[POST CUSTOM FIELD] Campo ${fieldId}`);

    console.log("[1] Valor ENVIADO PARA API:");
    console.log({
        projectId,
        fieldId,
        valueEnviado: value
    });

    try {
        const url = `${WORKER_URL}/solarmarket/projects/${projectId}/custom-fields/${fieldId}`;
        console.log("[2] URL destino:", url);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ value })
        });

        console.log("[3] STATUS da resposta:", response.status);

        let json;
        try {
            json = await response.json();
        } catch (e) {
            console.log("[4] A API não retornou JSON válido.");
            json = null;
        }

        console.log("[5] CONTEÚDO BRUTO DA RESPOSTA DA API (no POST):");
        console.log(json);

        console.groupEnd();

        return { sucesso: response.ok, dados: json };
    } catch (error) {
        console.error("[ERRO POST CUSTOM FIELD]", error);
        console.groupEnd();
        throw error;
    }
}

// =================================================
// Função utilitária: formata valor antes de enviar para SolarMarket
// =================================================
export function formatarValorParaEnvio(valor, tipo = 'text') {
    if (tipo === 'money') return converterStringParaNumero(valor);
    if (tipo === 'textarea' || tipo === 'text') return valor ? valor.trim() : '';
    return valor;
}
