// js/model.js
// ==========================================
// MODEL — versão ATUALIZADA para produção com rastreamento de usuário
// ==========================================

// Importa cliente da API
import { getProject, getProjectProposal, getCustomFields, postCustomField } from './api.js';
import { parseLinhaParaItem, somaListaValores, SEPARADOR, parseLinhaSeparador, converterStringParaNumero } from './utils.js';

function parsearCampoTexto(texto) {
    if (!texto) return [];
    // Lógica de parsing que estava no controller, agora centralizada no model.
    const linhas = texto.split('\n');
    return linhas.filter(l => l.trim() !== '').map((linha, index) => {
        const partes = parseLinhaSeparador(linha);
        if (partes.length < 2) return null;

        // Lógica para lidar com formato novo (com data) e antigo (sem data)
        if (partes.length >= 4) { // Formato novo: user | date | desc | valor
            const [user, date, descricao, valorStr] = partes;
            const valor = parseFloat(String(valorStr).replace(/\./g, '').replace(',', '.')) || 0;
            return { id: Date.now() + index, user, date, descricao, valor };
        } else if (partes.length >= 3) { // Formato antigo: user | desc | valor
            const [user, descricao, valorStr] = partes;
            const valor = parseFloat(String(valorStr).replace(/\./g, '').replace(',', '.')) || 0;
            return { id: Date.now() + index, user, date: null, descricao, valor }; // date é null
        } else { // Formato mais antigo ainda: desc | valor
            const [descricao, valorStr] = partes;
            const valor = parseFloat(String(valorStr).replace(/\./g, '').replace(',', '.')) || 0;
            return { id: Date.now() + index, user: null, date: null, descricao, valor }; // user e date são null
        }
    }).filter(Boolean);
}

function parsearCampoIndicacao(texto) {
    if (!texto) return [];
    const linhas = texto.split('\n');
    return linhas.filter(l => l.trim() !== '').map((linha, index) => {
        const partes = parseLinhaSeparador(linha);
        if (partes.length < 3) return null;

        if (partes.length >= 5) { // Formato novo: user | date | nome | tel | valor
            const [user, date, nome, telefone, valorStr] = partes;
            const valor = parseFloat(String(valorStr).replace(/\./g, '').replace(',', '.')) || 0;
            return { id: Date.now() + index, user, date, nome, telefone, valor };
        } else { // Formato antigo: user | nome | tel | valor
            const [user, nome, telefone, valorStr] = partes;
            const valor = parseFloat(String(valorStr).replace(/\./g, '').replace(',', '.')) || 0;
            return { id: Date.now() + index, user, date: null, nome, telefone, valor };
        }
    }).filter(Boolean);
}
function parsearCampoCombustivel(texto) {
    if (!texto) return [];
    return texto.split('\n').filter(l => l.trim() !== '').map((linha, index) => {
        const partes = parseLinhaSeparador(linha);
        if (partes.length < 4) return null;

        const hasDate = partes.length >= 5 && /^\d{4}-\d{2}-\d{2}$/.test(partes[1]);
        const user = partes[0];
        const date = hasDate ? partes[1] : null;
        const finalidade = hasDate ? partes[2] : partes[1];
        const descricao = hasDate ? partes[3] : partes[2];
        const valorLitro = converterStringParaNumero(partes[partes.length - 2]);

        if (finalidade === 'Venda') {
            const distancia = converterStringParaNumero(hasDate ? partes[4] : partes[3]);
            return {
                id: Date.now() + index, user, date, finalidade, descricao,
                distancia, valorLitro
            };
        } else if (finalidade === 'Instalação') {
            const litros = converterStringParaNumero(hasDate ? partes[4] : partes[3]);
            return {
                id: Date.now() + index, user, date, finalidade, descricao,
                litros, valorLitro
            };
        }
        return null;
    }).filter(Boolean);
}

function normalizarValorMoney(valor) {
    if (valor === null || valor === undefined || valor === '') return 0;

    // API vem como "0.00", "12.34", 15.50 etc.
    const n = parseFloat(String(valor).replace(',', '.'));

    return isNaN(n) ? 0 : n;
}

// Mapa estático com TODOS os IDs de campos customizados conhecidos.
// Esta é a "fonte da verdade" e resolve o problema de campos vazios não retornados pela API.
const ALL_FIELD_IDS = {
    '[cap_nome_indicador]': 10073,
    '[cap_indicacao]': 12019,
    '[cap_rg_cliente]': 12644,
    '[cap_combustivel]': 44994,
    '[cap_comprovantes_combust]': 44995,
    '[cap_ferram_escada_descricao]': 44991, // Este é o campo de descrição de Ferramentas
    '[cap_dados_indicador]': 44996,
    '[cap_custos]': 44974, // Chave antiga para Material
    '[cap_comprovantes]': 44972,
    '[cap_total_custos]': 44999,
    '[cap_total_custos_material]': 45005,
    '[cap_aluguel_ferramentas]': 44981, // Este é o campo monetário de Ferramentas
    '[cap_quilometragem_percorrida]': 45008,
    '[cap_despesas_projeto]': 45006, // Chave para a lista de itens
    '[cap_total_despesas_projeto]': 45004,
    '[cap_despesas_fixas_gerais]': 45007,
    '[cap_total_despesas_fixas_gerais]': 45002,
    '[cap_diarias]': 45013, // CORREÇÃO: Restaurando a chave para o campo de texto de diárias.
    '[cap_comprovantes_desp_fixas_gerais]': 45010,
    '[cap_comprovantes_desp_projeto]': 45009,
    '[cap_total_diarias]': 45014,
    '[cap_valor_indicacao]': 44997, // CORREÇÃO: Adicionando a chave do valor da indicação ao mapa de IDs.
    '[cap_comprovante_indicacao]': 45000,
    '[cap_comprovantes_alugueis]': 44989,
    '[cap_alimentacao]': 44988, // Este é o campo de TOTAL de alimentação
    '[cap_alimentacao_itens]': 45029, // CORREÇÃO: Adicionando a chave da lista de itens de alimentação ao mapa de IDs.
    '[cap_comprovantes_alimentacao]': 44990,
};

// ===============================
// PARTE 1 — Carregar e interpretar projeto
// ===============================

export async function buscarEProcessarProjeto(projectId) {
    // 1 — Buscar dados principais do projeto
    const respProj = await getProject(projectId);
    if (!respProj.sucesso) return null;
    const meta = respProj.dados;

    // 2 — Buscar dados da proposta ativa
    const respProposal = await getProjectProposal(projectId);
    if (!respProposal.sucesso) return null;
    const proposalData = respProposal.dados;

    // 2 — Buscar campos customizados
    const respCustom = await getCustomFields(projectId);
    if (!respCustom.sucesso) return null;
    const campos = respCustom.dados || [];

    console.group("[API → PROCESSAR CAMPOS CUSTOMIZADOS]");
    console.log("Dados brutos recebidos da API (no GET):");
    console.log(JSON.parse(JSON.stringify(campos))); // Loga uma cópia para evitar mutações
    console.groupEnd();

    // 3 — Montar objeto rawFields e fieldIds
    const raw = {};
    for (const item of campos) { // Este loop agora serve apenas para preencher os valores existentes.
        const key = item.customField.key;
        let value = item.value ?? '';
        const type = item.customField.type;

        // Se o tipo do campo é "money", normalizar imediatamente
        if (type === 'money') {
            value = normalizarValorMoney(value); // transforma "0.00" → 0
        }

        // CORREÇÃO: Acumula valores para campos de arquivo, em vez de sobrescrever.
        if (type === 'file' && raw[key]) {
            // Se a chave já existe e é um arquivo, concatena a nova URL.
            raw[key] += '\n' + value;
        } else {
            // Para todos os outros casos (ou o primeiro arquivo), apenas atribui o valor.
            raw[key] = value;
        }
    }

    // ===============================
    // PARTE 2 — Parse multilinhas
    // ===============================
    const material    = parsearCampoTexto(raw[KEYS.MATERIAL]);

    const diarias     = parsearCampoTexto(raw[KEYS.DIARIAS]);
    const despProj    = parsearCampoTexto(raw[KEYS.DESPESAS_PROJETO]);
    const despFixas   = parsearCampoTexto(raw[KEYS.DESPESAS_FIXAS]);
    const ferramenta  = parsearCampoTexto(raw[KEYS.FERRAMENTA]);
    const alimentacao = parsearCampoTexto(raw[KEYS.ALIMENTACAO]);
    const indicacao   = parsearCampoIndicacao(raw[KEYS.INDICACAO]); // CORREÇÃO: Usa a função de parsing correta para Indicação.

    const combustivelItens = parsearCampoCombustivel(raw['[cap_quilometragem_percorrida]']);

    // ===============================
    // PARTE 3 — Totais
    // ===============================
    const totalMaterial  = somaListaValores(material);
    const totalDiarias   = somaListaValores(diarias);
    const totalDespProj  = somaListaValores(despProj);
    const totalDespFixas = somaListaValores(despFixas);
    const totalFerram    = somaListaValores(ferramenta);
    const totalAlimentacao = somaListaValores(alimentacao);
    const totalIndicacao = somaListaValores(indicacao); // 'indicacao' já é uma lista processada
    const totalCombustivel = somaListaValores(combustivelItens);

    // ===============================
    // PARTE 4 — Cálculos com dados da Proposta
    // ===============================
    const valorTotalProposta = proposalData.pricingTable.reduce((acc, item) => acc + item.salesValue, 0);
    const valorKitFotovoltaico = proposalData.pricingTable
        .find(item => item.category === 'KIT')?.totalCost ?? 0;

    const baseCalculoImposto = valorTotalProposta - valorKitFotovoltaico;
    const imposto = baseCalculoImposto * 0.12;
    const impostoPercentual = baseCalculoImposto > 0 ? (imposto / baseCalculoImposto) * 100 : 0;

    const totalOutras = totalDespProj + totalDespFixas + totalFerram + totalAlimentacao + totalIndicacao; // Soma de todas as despesas que não são Material, Diárias ou Combustível
    const totalGeral  = totalMaterial + totalDiarias + totalCombustivel + totalOutras; // Soma total de todos os custos

    return {
        id: meta.identifier,
        nomeCliente: meta.client?.name ?? '—',
        cliente: meta.client?.name ?? '—',
        dataCriacao: proposalData.generatedAt || meta.createdAt, // Prioriza a data de geração da proposta
        status: meta.deletedAt ? 'Arquivado' : 'Ativo', // Mantém a lógica de status

        // Prioriza os valores da proposta, com fallback para campos customizados
        valorProposta: valorTotalProposta || raw['[cap_valor_total]'] || 0,
        valorKit: valorKitFotovoltaico || raw['[cap_valor_kit_fotovoltaico]'] || 0,
        imposto: {
            valor: imposto,
            percentual: impostoPercentual
        },

        rawFields: raw,
        fieldIds: ALL_FIELD_IDS, // Usa o mapa estático completo como fonte da verdade para os IDs.
        meta: meta,

        itens: {
            material,
            diarias,
            despProjeto: despProj,
            despFixasGerais: despFixas,
            ferramenta,
            indicacao, // <-- CORREÇÃO: Inclui os itens de indicação no objeto de retorno.
            alimentacao,
            combustivel: combustivelItens
        },

        totais: {
            material: totalMaterial,
            diarias: totalDiarias,
            despProjeto: totalDespProj,
            despFixas: totalDespFixas,
            ferramenta: totalFerram,
            alimentacao: totalAlimentacao, // CORREÇÃO: Adiciona o total de alimentação ao objeto de retorno
            indicacao: totalIndicacao,
            combustivel: totalCombustivel,
            outras: totalOutras,
            totalGeral
        }
    };
}

// ===============================
// PARTE 6 — Atualizar múltiplos campos via API
// ===============================

export async function atualizarMultiplosCampos(projectId, payload, fieldIds) {
    const mapping = {
        material:                  '[cap_material]',
        diarias:                   '[cap_diarias_mo]',
        despProjeto:               '[cap_despesas_projeto]',
        despFixasGerais:           '[cap_despesas_fixas_gerais]',
        ferramenta:                '[cap_ferramenta_escada]',

        combustivelTexto:          '[cap_quilometragem_percorrida]',
        totalCombustivel:          '[cap_total_combustivel]',

        totalMaterial:             '[cap_total_custos_material]',
        totalDiarias:              '[cap_total_diarias_mo]',
        totalDespProjeto:          '[cap_total_despesas_projeto]',
        totalDespFixas:            '[cap_total_despesas_fixas_gerais]',
        totalFerramenta:           '[cap_total_ferramenta_escada]',
        totalOutras:               '[cap_total_outras_despesas]',
        totalGeral:                '[cap_total_geral]'
    };

    const updates = Object.entries(mapping).map(([key, fieldKey]) => {
        const fieldId = fieldIds[fieldKey];
        if (!fieldId) return Promise.resolve({ sucesso: false, mensagem: `Campo ${fieldKey} não encontrado` });
        const valor = payload[key];
        return postCustomField(projectId, fieldId, String(valor));
    });

    const results = await Promise.all(updates);
    const ok = results.every(r => r.sucesso);

    return {
        sucesso: ok,
        resultados: results
    };
}

// Export vazio apenas para compatibilidade com o controller
export const KEYS = {
    // FIX: Alinha as chaves de lista com o que VEM na API
    MATERIAL: '[cap_custos]',
    DIARIAS: '[cap_diarias]', // CORREÇÃO: Revertendo para a chave correta. O problema de truncamento é na API.
    DESPESAS_PROJETO: '[cap_despesas_projeto]',
    DESPESAS_FIXAS: '[cap_despesas_fixas_gerais]',
    FERRAMENTA: '[cap_ferram_escada_descricao]', // Corrigido de '[cap_ferramenta_escada]'
    INDICACAO: '[cap_dados_indicador]', // CORREÇÃO: A chave principal de Indicação agora aponta para o campo de texto.
    COMBUSTIVEL: '[cap_quilometragem_percorrida]',
    ALIMENTACAO: '[cap_alimentacao_itens]',
    VALOR_TOTAL: '[cap_valor_total]', // Valor da proposta
    VALOR_KIT: '[cap_valor_kit_fotovoltaico]',
    // Campos de totais
    TOTAL_MATERIAL: '[cap_total_custos_material]',
    TOTAL_DIARIAS: '[cap_total_diarias]',
    TOTAL_DESPESAS_PROJETO: '[cap_total_despesas_projeto]', // Chave para o total de Despesas de Projeto
    TOTAL_DESPESAS_FIXAS: '[cap_total_despesas_fixas_gerais]', // CORREÇÃO: Padronizado de 'TOTAL_DESP_FIXAS'
    TOTAL_FERRAMENTA: '[cap_aluguel_ferramentas]', // CORREÇÃO: Usando o campo monetário correto para Aluguel/Ferramenta
    TOTAL_COMBUSTIVEL: '[cap_combustivel]',
    TOTAL_ALIMENTACAO: '[cap_alimentacao]', // O campo de total de alimentação
    TOTAL_INDICACAO: '[cap_valor_indicacao]', // O campo de total para Indicação
    // Chaves para os campos de comprovantes (arquivos/URLs)
    COMPROVANTES_DIARIAS: '[cap_comprovantes_diarias]', // Campo que será usado para a lista de itens de diárias.
    COMPROVANTES_MATERIAL: '[cap_comprovantes]', 
    COMPROVANTES_DESP_PROJETO: '[cap_comprovantes_desp_projeto]',
    COMPROVANTES_DESP_FIXAS: '[cap_comprovantes_desp_fixas_gerais]',
    COMPROVANTES_ALUGUEIS: '[cap_comprovantes_alugueis]', // Para Ferramenta/Escada
    COMPROVANTES_ALIMENTACAO: '[cap_comprovantes_alimentacao]',
    COMPROVANTES_COMBUSTIVEL: '[cap_comprovantes_combust]',
    COMPROVANTE_INDICACAO: '[cap_comprovante_indicacao]'
};

export async function atualizarCampoUnico(projectId, fieldKey, novoConteudo, fieldIds) {
    const fieldId = fieldIds[fieldKey];
    if (!fieldId) return { sucesso: false, mensagem: `Chave de campo inválida: ${fieldKey}` };

    return await postCustomField(projectId, fieldId, novoConteudo);
}

export { getMe } from './api.js';
