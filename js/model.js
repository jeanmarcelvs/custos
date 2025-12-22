import { getProject, getProjectProposal, getCustomFields, postCustomField, getMe } from './api.js';
import { somaListaValores, parseLinhaSeparador, converterStringParaNumero } from './utils.js';

/**
 * ============================================================
 * MAPA DE CHAVES DE CAMPOS (PRECISA VIR PRIMEIRO)
 * ============================================================
 * Mapeamento de chaves locais para as chaves de campo da API SolarMarket.
 * Usado para consistência em todo o aplicativo.
 */
export const KEYS = {
    // Chaves para campos de texto com listas de itens
    MATERIAL: '[cap_custos]',
    DIARIAS: '[cap_diarias]',
    DESPESAS_PROJETO: '[cap_despesas_projeto]',
    DESPESAS_FIXAS: '[cap_despesas_fixas_gerais]',
    FERRAMENTA: '[cap_ferram_escada_descricao]',
    INDICACAO: '[cap_dados_indicador]',
    COMBUSTIVEL: '[cap_quilometragem_percorrida]',
    ALIMENTACAO: '[cap_alimentacao_itens]',

    // Chaves para valores monetários principais
    VALOR_TOTAL: '[cap_valor_total]',
    VALOR_KIT: '[cap_valor_kit_fotovoltaico]',

    // Chaves para campos de totais calculados
    TOTAL_MATERIAL: '[cap_total_custos_material]',
    TOTAL_DIARIAS: '[cap_total_diarias]',
    TOTAL_DESPESAS_PROJETO: '[cap_total_despesas_projeto]',
    TOTAL_DESPESAS_FIXAS: '[cap_total_despesas_fixas_gerais]',
    TOTAL_FERRAMENTA: '[cap_aluguel_ferramentas]',
    TOTAL_COMBUSTIVEL: '[cap_combustivel]',
    TOTAL_ALIMENTACAO: '[cap_alimentacao]',
    TOTAL_INDICACAO: '[cap_valor_indicacao]',

    // Chaves para campos de comprovantes (arquivos)
    COMPROVANTES_DIARIAS: '[cap_comprovantes_diarias]',
    COMPROVANTES_MATERIAL: '[cap_comprovantes]', 
    COMPROVANTES_DESP_PROJETO: '[cap_comprovantes_desp_projeto]',
    COMPROVANTES_DESP_FIXAS: '[cap_comprovantes_desp_fixas_gerais]',
    COMPROVANTES_ALUGUEIS: '[cap_comprovantes_alugueis]',
    COMPROVANTES_ALIMENTACAO: '[cap_comprovantes_alimentacao]',
    COMPROVANTES_COMBUSTIVEL: '[cap_comprovantes_combust]',
    COMPROVANTE_INDICACAO: '[cap_comprovante_indicacao]',
    DOC_PROJETO: '[cap_doc_projeto]' // Adicionado para documentos do projeto
};

/**
 * ============================================================
 * MAPA DE IDS DE CAMPOS
 * ============================================================
 * Mapa estático com todos os IDs de campos customizados conhecidos.
 */
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
    '[cap_doc_projeto]': 5569, // Adicionado para documentos do projeto
    '[cap_alimentacao]': 44988, // Este é o campo de TOTAL de alimentação
    '[cap_alimentacao_itens]': 45029, // CORREÇÃO: Adicionando a chave da lista de itens de alimentação ao mapa de IDs.
    '[cap_comprovantes_alimentacao]': 44990,
};

/**
 * Parseia um campo de texto multilinhas em um array de objetos.
 * Lida com múltiplos formatos de linha (novo com data, antigo sem data).
 * @param {string} texto - O conteúdo do campo de texto.
 * @returns {Array<object>} Um array de itens, cada um com id, user, date, descricao, e valor.
 */
function parsearCampoTexto(texto) {
    if (!texto || texto.trim() === '') return [];

    // 1. Tenta parsear como JSON (novo formato, mais robusto)
    try {
        const itens = JSON.parse(texto);
        if (Array.isArray(itens)) {
            console.log(`[parsearCampoTexto] Sucesso ao parsear como JSON.`);
            return itens.map((item, index) => ({ id: item.id || Date.now() + index, ...item }));
        }
    } catch (e) {
        // 2. Se falhar, assume que é o formato antigo (string com separadores) e faz o parse legado.
        console.warn("[parsearCampoTexto] Falha ao parsear como JSON, recorrendo ao parser legado. Texto:", texto);
        const linhas = texto.split('\n');
        return linhas.filter(l => l.trim() !== '').map((linha, index) => {
            const partes = parseLinhaSeparador(linha);
            if (partes.length < 2) return null;

            if (partes.length >= 4) { // Formato novo: user | date | desc | valor
                const [user, date, descricao, valorStr] = partes;
                const valor = converterStringParaNumero(valorStr);
                return { id: Date.now() + index, user, date, descricao, valor };
            } else if (partes.length >= 3) { // Formato antigo: user | desc | valor
                const [user, descricao, valorStr] = partes;
                const valor = converterStringParaNumero(valorStr);
                return { id: Date.now() + index, user, date: null, descricao, valor };
            } else { // Formato mais antigo ainda: desc | valor
                const [descricao, valorStr] = partes;
                const valor = converterStringParaNumero(valorStr);
                return { id: Date.now() + index, user: null, date: null, descricao, valor };
            }
        }).filter(Boolean);
    }
    return []; // Retorna array vazio se o JSON for válido mas não for um array
}

/**
 * Parseia o campo de texto de indicações em um array de objetos.
 * Lida com formatos de linha com e sem data.
 * @param {string} texto - O conteúdo do campo de texto de indicações.
 * @returns {Array<object>} Um array de itens de indicação.
 */
function parsearCampoIndicacao(texto) {
    if (!texto || texto.trim() === '') return [];

    try {
        const itens = JSON.parse(texto);
        if (Array.isArray(itens)) {
            console.log(`[parsearCampoIndicacao] Sucesso ao parsear como JSON.`);
            return itens.map((item, index) => ({ id: item.id || Date.now() + index, ...item }));
        }
    } catch (e) {
        console.warn("[parsearCampoIndicacao] Falha ao parsear como JSON, recorrendo ao parser legado. Texto:", texto);
        const linhas = texto.split('\n');
        return linhas.filter(l => l.trim() !== '').map((linha, index) => {
            const partes = parseLinhaSeparador(linha);
            if (partes.length < 3) return null;

            if (partes.length >= 5) { // Formato novo: user | date | nome | tel | valor
                const [user, date, nome, telefone, valorStr] = partes;
                const valor = converterStringParaNumero(valorStr);
                return { id: Date.now() + index, user, date, nome, telefone, valor };
            } else { // Formato antigo: user | nome | tel | valor
                const [user, nome, telefone, valorStr] = partes;
                const valor = converterStringParaNumero(valorStr);
                return { id: Date.now() + index, user, date: null, nome, telefone, valor };
            }
        }).filter(Boolean);
    }
    return [];
}

/**
 * Parseia o campo de texto de combustível em um array de objetos.
 * Distingue entre itens de 'Venda' (com distância) e 'Instalação' (com litros).
 * @param {string} texto - O conteúdo do campo de texto de combustível.
 * @returns {Array<object>} Um array de itens de combustível.
 */
function parsearCampoCombustivel(texto) {
    if (!texto || texto.trim() === '') return [];

    try {
        const itens = JSON.parse(texto);
        if (Array.isArray(itens)) {
            console.log(`[parsearCampoCombustivel] Sucesso ao parsear como JSON.`);
            return itens.map((item, index) => ({ id: item.id || Date.now() + index, ...item }));
        }
    } catch (e) {
        console.warn("[parsearCampoCombustivel] Falha ao parsear como JSON, recorrendo ao parser legado. Texto:", texto);
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
    return [];
}

/**
 * Normaliza um valor monetário vindo da API para um número.
 * @param {string | number | null | undefined} valor - O valor a ser normalizado.
 * @returns {number} O valor numérico, ou 0 se inválido.
 */
function normalizarValorMoney(valor) {
    if (valor === null || valor === undefined || valor === '') return 0;
    const n = parseFloat(String(valor).replace(',', '.'));
    return isNaN(n) ? 0 : n;
}

/**
 * Busca todos os dados de um projeto (principais, proposta, campos customizados)
 * e os processa em um único objeto estruturado.
 * @param {string | number} projectId - O ID do projeto a ser buscado.
 * @returns {Promise<object | null>} Um objeto com todos os dados do projeto ou null se falhar.
 */
export async function buscarEProcessarProjeto(projectId) {
    // 1. Buscar dados principais do projeto primeiro para validar acesso
    const respProj = await getProject(projectId);

    if (!respProj.sucesso) {
        const erro = new Error(respProj.mensagem || 'Erro ao buscar projeto');
        erro.status = respProj.status;
        throw erro;
    }

    const meta = respProj.dados;
    if (!meta) {
        const erro = new Error('Dados do projeto não encontrados.');
        erro.status = 404;
        throw erro;
    }

    // 2. Buscar o restante dos dados em paralelo
    const [respProposal, respCustom] = await Promise.all([
        getProjectProposal(projectId),
        getCustomFields(projectId)
    ]);

    // 3. Validar as outras respostas, que são importantes mas não críticas para a existência do projeto
    if (!respProposal.sucesso) {
        const erro = new Error(respProposal.mensagem || 'Erro ao buscar proposta');
        erro.status = respProposal.status;
        throw erro;
    }
    const proposalData = respProposal.dados;
    if (!respCustom.sucesso) {
        const erro = new Error(respCustom.mensagem || 'Erro ao buscar campos customizados');
        erro.status = respCustom.status;
        throw erro;
    }
    const campos = respCustom.dados || [];

    // 4. Processar os dados recebidos (lógica inalterada)
    const raw = {};
    for (const item of campos) {
        const key = item.customField.key;
        let value = item.value ?? '';
        const type = item.customField.type;

        // Se o tipo do campo é "money", normalizar imediatamente
        if (type === 'money') {
            value = normalizarValorMoney(value); // transforma "0.00" → 0
        }

        if (type === 'file' && raw[key]) {
            raw[key] += '\n' + value;
        } else {
            // Para todos os outros casos (ou o primeiro arquivo), apenas atribui o valor.
            raw[key] = value;
        }
    }

    // 5. Parsear campos de texto multilinhas
    const material    = parsearCampoTexto(raw[KEYS.MATERIAL]);
    const diarias     = parsearCampoTexto(raw[KEYS.DIARIAS]);
    const despProj    = parsearCampoTexto(raw[KEYS.DESPESAS_PROJETO]);
    const despFixas   = parsearCampoTexto(raw[KEYS.DESPESAS_FIXAS]);
    const ferramenta  = parsearCampoTexto(raw[KEYS.FERRAMENTA]);
    const alimentacao = parsearCampoTexto(raw[KEYS.ALIMENTACAO]);
    const indicacao   = parsearCampoIndicacao(raw[KEYS.INDICACAO]);
    const combustivelItens = parsearCampoCombustivel(raw['[cap_quilometragem_percorrida]']);

    // 6. Calcular totais para cada categoria de custo
    const totalMaterial  = somaListaValores(material);
    const totalDiarias   = somaListaValores(diarias);
    const totalDespProj  = somaListaValores(despProj);
    const totalDespFixas = somaListaValores(despFixas);
    const totalFerram    = somaListaValores(ferramenta);
    const totalAlimentacao = somaListaValores(alimentacao);
    const totalIndicacao = somaListaValores(indicacao);
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
        dataCriacao: proposalData.generatedAt || meta.createdAt,
        status: meta.deletedAt ? 'Arquivado' : 'Ativo',

        // Valores principais (prioriza proposta, com fallback para campos customizados)
        valorProposta: valorTotalProposta || raw['[cap_valor_total]'] || 0,
        valorKit: valorKitFotovoltaico || raw['[cap_valor_kit_fotovoltaico]'] || 0,
        imposto: {
            valor: imposto,
            percentual: impostoPercentual
        },

        rawFields: raw,
        fieldIds: ALL_FIELD_IDS,
        meta: meta,

        itens: {
            material,
            diarias,
            despProjeto: despProj,
            despFixasGerais: despFixas,
            ferramenta,
            indicacao,
            alimentacao,
            combustivel: combustivelItens
        },

        totais: {
            material: totalMaterial,
            diarias: totalDiarias,
            despProjeto: totalDespProj,
            despFixas: totalDespFixas,
            ferramenta: totalFerram,
            alimentacao: totalAlimentacao,
            indicacao: totalIndicacao,
            combustivel: totalCombustivel,
            outras: totalOutras,
            totalGeral
        }
    };
}

/**
 * Atualiza múltiplos campos customizados de uma vez.
 * @param {string | number} projectId - O ID do projeto.
 * @param {object} payload - Um objeto onde as chaves correspondem às categorias de custo (ex: 'material') e os valores são o conteúdo a ser salvo.
 * @param {object} fieldIds - O mapa de IDs de campos do projeto.
 * @returns {Promise<{sucesso: boolean, resultados: any[]}>}
 */
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

export async function atualizarCampoUnico(projectId, fieldKey, novoConteudo, fieldIds) {
    const fieldId = fieldIds[fieldKey];
    if (!fieldId) return { sucesso: false, mensagem: `Chave de campo inválida: ${fieldKey}` };

    return await postCustomField(projectId, fieldId, novoConteudo);
}

// Re-exporta a função getMe da API para uso em outros controllers.
export { getMe } from './api.js';
