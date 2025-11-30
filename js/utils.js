/**
 * js/utils.js — VERSÃO ATUALIZADA PARA PRODUÇÃO
 * Funções puras para formatação e parsing de dados da SolarMarket.
 */

/* ============================
   Separador padrão
   ============================ */
export const SEPARADOR = ' | ';

/* ============================
   Formatação de valores e datas
   ============================ */

/**
 * Formata número para moeda BRL (R$ 1.200,50)
 */
export function formatarMoeda(valor) {
    if (valor === null || valor === undefined || isNaN(valor)) return 'R$ 0,00';
    return parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Formata número para BRL sem símbolo (0,00)
 */
export function formatarNumeroParaBR(valor) {
    const n = Number(valor) || 0;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
}

/**
 * Formata data ISO para BR (dd/mm/yyyy)
 */
export function formatarData(dataString) {
    if (!dataString) return '-';
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR');
}

/**
 * NOVO: Arredonda um número para 2 casas decimais para evitar erros de float.
 * Ex: 103.0399999 se torna 103.04
 */
export function arredondarParaDuasCasas(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Converte string monetária ("R$ 1.200,50" ou "1200,50") para número float
 */
export function converterStringParaNumero(valor) {
    if (valor === null || valor === undefined || valor === '') return 0;
    if (typeof valor === 'number') return valor;

    let str = valor.toString().trim();
    str = str.replace('R$', '').trim();

    // Se a string contém vírgula, assume-se formato BR (1.234,56) e removemos os pontos.
    // Se não, assume-se formato internacional (1234.56) e não removemos o ponto.
    if (str.includes(',')) {
        str = str.replace(/\./g, '').replace(',', '.');
    }
    return parseFloat(str) || 0;
}

/* ============================
   Funções de linhas separadas por " | "
   ============================ */

/**
 * Parseia uma linha de texto padronizada com " | "
 * Retorna array de strings
 */
export function parseLinhaSeparador(linha) {
    if (!linha || linha.trim() === '') return [];
    return linha.split(SEPARADOR).map(s => s.trim()).filter(s => s !== '');
}

/**
 * Transforma array de strings em linha padronizada
 */
export function formatarLinhaSeparador(itens) {
    if (!Array.isArray(itens) || itens.length === 0) return '';
    return itens.map(i => i.toString().trim()).join(SEPARADOR);
}

/* ============================
   Funções específicas de Combustível
   ============================ */

/**
 * Parseia uma linha de combustível ou quilometragem genérica
 * Formato esperado: "Finalidade | Tipo | Valor"
 * Retorna objeto {finalidade, tipo, valor}
 * Caso linha com apenas 2 campos: {descricao, valor}
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
 * Converte objeto de combustível em linha de texto padronizada
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
 * Parseia uma linha completa de combustível do SolarMarket.
 * Formato: Finalidade | Descrição | Distancia/Litros | Consumo | ValorLitro | Total
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
   Funções para campos monetários
   ============================ */

/**
 * Parseia linha monetária: "210,00 | Escada" ou "210,00"
 * Retorna objeto {valor, descricao}
 */
export function parseLinhaMonetaria(linha) {
    if (!linha || linha.trim() === '') return null;
    const partes = linha.split(SEPARADOR).map(s => s.trim());
    const valor = converterStringParaNumero(partes[0]);
    const descricao = partes[1] || '';
    return { valor, descricao };
}

/**
 * Formata objeto monetário para linha padronizada
 */
export function formatLinhaMonetaria(item) {
    if (!item) return '';
    if (item.descricao) {
        return `${formatarNumeroParaBR(item.valor)}${SEPARADOR}${item.descricao}`;
    }
    return `${formatarNumeroParaBR(item.valor)}`;
}

/**
 * Formata o valor de um input em tempo real para o formato monetário BRL.
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
   Funções auxiliares adicionais
   ============================ */

/**
 * Somatório de uma lista de objetos com atributo 'valor'
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
