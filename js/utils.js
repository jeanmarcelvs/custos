/**
 * Separador padrão usado em campos de texto com múltiplos valores.
 * @constant {string}
 */
export const SEPARADOR = ' | ';

/**
 * Formata um valor numérico como moeda brasileira (BRL).
 * @param {number | string | null | undefined} valor - O valor a ser formatado.
 * @returns {string} O valor formatado como moeda (ex: "R$ 1.234,56").
 */
export function formatarMoeda(valor) {
    if (valor === null || valor === undefined || isNaN(valor)) return 'R$ 0,00';
    return parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Formata um número para o padrão brasileiro com duas casas decimais, sem o símbolo da moeda.
 * @param {number | string} valor - O valor a ser formatado.
 * @returns {string} O número formatado (ex: "1234,56").
 */
export function formatarNumeroParaBR(valor) {
    const n = Number(valor) || 0;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
}

/**
 * Formata uma string de data (ou objeto Date) para o formato de data brasileiro (dd/mm/yyyy).
 * @param {string | Date} dataString - A data a ser formatada.
 * @returns {string} A data formatada ou '-' se a entrada for inválida.
 */
export function formatarData(dataString) {
    if (!dataString) return '-';
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR');
}

/**
 * Arredonda um número para duas casas decimais para evitar imprecisões de ponto flutuante.
 * @param {number} num - O número a ser arredondado.
 * @returns {number} O número arredondado.
 */
export function arredondarParaDuasCasas(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Converte uma string (potencialmente em formato monetário brasileiro) para um número.
 * @param {string | number | null | undefined} valor - A string a ser convertida.
 * @returns {number} O número resultante. Retorna 0 se a conversão falhar.
 */
export function converterStringParaNumero(valor) {
    if (valor === null || valor === undefined || valor === '') return 0;
    if (typeof valor === 'number') return valor;

    let str = valor.toString().trim();
    str = str.replace('R$', '').trim();

    if (str.includes(',')) {
        str = str.replace(/\./g, '').replace(',', '.');
    }
    return parseFloat(str) || 0;
}

/**
 * Divide uma string em um array de partes, usando o SEPARADOR padrão.
 * @param {string} linha - A string a ser dividida.
 * @returns {string[]} Um array com as partes da string.
 */
export function parseLinhaSeparador(linha) {
    if (!linha || linha.trim() === '') return [];
    return linha.split(SEPARADOR).map(s => s.trim()).filter(s => s !== '');
}

/**
 * Junta um array de itens em uma única string, usando o SEPARADOR padrão.
 * @param {any[]} itens - O array de itens a serem juntados.
 * @returns {string} A string resultante.
 */
export function formatarLinhaSeparador(itens) {
    if (!Array.isArray(itens) || itens.length === 0) return '';
    return itens.map(i => i.toString().trim()).join(SEPARADOR);
}

/* ============================
   Funções de Parsing de Itens
   ============================ */

/**
 * Parseia uma linha de texto genérica em um objeto com descrição e valor.
 * @param {string} linha - A linha a ser parseada (ex: "Finalidade | Tipo | 123,45" ou "Descrição | 123,45").
 * @returns {{finalidade?: string, tipo?: string, descricao?: string, valor: number} | null}
 */
export function parseLinhaParaItem(linha) {
    if (!linha || linha.trim() === '') return null;

    const partes = linha.split(SEPARADOR).map(s => s.trim());
    if (partes.length < 2) return null;

    if (partes.length >= 3) {
        return {
            finalidade: partes[0],
            tipo: partes[1],
            valor: converterStringParaNumero(partes[2])
        };
    }

    // Apenas 2 campos: descrição | valor
    return {
        descricao: partes[0],
        valor: converterStringParaNumero(partes[1])
    };
}

/**
 * Formata um objeto de item de combustível em uma string padronizada.
 * @param {object} item - O objeto do item.
 * @returns {string} A string formatada.
 */
export function formatCombustivelParaLinha(item) {
  if (!item || typeof item !== 'object') {
        console.log('[utils.js | formatCombustivelParaLinha] Ignorando item nulo ou indefinido.');
        return '';
    }

    const v = converterStringParaNumero(item.valor);

  // Caso 1: item de combustível com finalidade + tipo + valor
  if (item.finalidade && item.tipo && item.valor !== undefined && item.valor !== null) {
    const output = `${String(item.finalidade)}${SEPARADOR}${String(item.tipo)}${SEPARADOR}${formatarNumeroParaBR(v)}`;
        console.log(`[utils.js | formatCombustivelParaLinha] Input (combustível):`, item, `Output: "${output}"`);
        return output;
    }

  // Caso 2: item genérico com descricao + valor
  if (item.descricao && item.valor !== undefined && item.valor !== null) {
    const output = `${String(item.descricao)}${SEPARADOR}${formatarNumeroParaBR(v)}`;
        console.log(`[utils.js | formatCombustivelParaLinha] Input (genérico):`, item, `Output: "${output}"`);
        return output;
    }

  // fallback
  console.log('[utils.js | formatCombustivelParaLinha] Item não corresponde a nenhum formato esperado:', item);
  return '';
}

/**
 * Parseia uma linha completa de dados de combustível.
 * @param {string} linha - A linha de texto a ser parseada.
 * @returns {object | null} Um objeto com os dados de combustível ou null se o formato for inválido.
 */
export function parseLinhaCombustivelCompleta(linha) {
    if (!linha || linha.trim() === '') return null;

    const partes = linha.split(SEPARADOR).map(s => s.trim());
    if (partes.length < 5) return null; // Precisa de pelo menos 5 partes

    const finalidade = partes[0];
    if (finalidade === 'Venda') {
        return {
            finalidade,
            descricao: partes[1],
            distancia: converterStringParaNumero(partes[2]),
            consumo: converterStringParaNumero(partes[3]),
            valorLitro: converterStringParaNumero(partes[4]),
            custo: converterStringParaNumero(partes[5]) // Adiciona o parse do custo
        };
    }
    if (finalidade === 'Instalação') {
        return {
            finalidade,
            descricao: partes[1],
            litros: converterStringParaNumero(partes[2]),
            valorLitro: converterStringParaNumero(partes[4]),
            custo: converterStringParaNumero(partes[5]) // Adiciona o parse do custo
        };
    }

    return null;
}

/* ============================
   Funções de UI e Formatação
   ============================ */

/**
 * Parseia uma linha de texto que contém um valor monetário e uma descrição opcional.
 * @param {string} linha - A linha a ser parseada.
 * @returns {{valor: number, descricao: string} | null}
 */
export function parseLinhaMonetaria(linha) {
    if (!linha || linha.trim() === '') return null;
    const partes = linha.split(SEPARADOR).map(s => s.trim());
    const valor = converterStringParaNumero(partes[0]);
    const descricao = partes[1] || '';
    return { valor, descricao };
}

/**
 * Formata um objeto com valor e descrição em uma string padronizada.
 * @param {{valor: number, descricao?: string}} item - O objeto a ser formatado.
 * @returns {string} A string formatada.
 */
export function formatLinhaMonetaria(item) {
    if (!item) return '';
    if (item.descricao) {
        return `${formatarNumeroParaBR(item.valor)}${SEPARADOR}${item.descricao}`;
    }
    return `${formatarNumeroParaBR(item.valor)}`;
}

/**
 * Formata o valor de um campo de input em tempo real para o formato de moeda BRL.
 * @param {HTMLInputElement} inputElement - O elemento de input a ser formatado.
 */
export function formatarInputMonetario(inputElement) {
    let valor = inputElement.value.replace(/\D/g, ''); // Remove tudo que não for dígito
    if (valor === '') {
        inputElement.value = '';
        return;
    }
    valor = (parseInt(valor, 10) / 100).toLocaleString('pt-BR', {
        style: 'currency', currency: 'BRL'
    });
    inputElement.value = valor;
}

/* ============================
   Funções de Agregação
   ============================ */

/**
 * Soma os valores de uma lista de itens, com lógica especial para itens de combustível.
 * @param {Array<object>} lista - A lista de itens a serem somados.
 * @returns {number} O total somado.
 */
export function somaListaValores(lista) {
    if (!Array.isArray(lista)) return 0;
    return lista.reduce((total, item) => {
        if (item.finalidade === 'Venda') {
            // Cálculo específico para combustível de Venda
            const custo = (item.distancia * 2 / 10.6) * item.valorLitro;
            return total + (custo || 0);
        } else if (item.finalidade === 'Instalação') {
            // Cálculo específico para combustível de Instalação
            const custo = item.litros * item.valorLitro;
            return total + (custo || 0);
        }
        // Cálculo padrão para todas as outras categorias
        return total + (item.valor || 0);
    }, 0);
}
