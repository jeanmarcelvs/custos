// js/controller.js — VERSÃO REESTRUTURADA MODAL PROFISSIONAL
// Dependências: model.js, utils.js

import {
  buscarEProcessarProjeto,
  processarEGerarPayload,
  atualizarMultiplosCampos,
  prepararPayloadEdicao,
  KEYS
} from './model.js';

import { formatarMoeda, formatarData, parseLinhaParaItem, formatCombustivelParaLinha } from './utils.js';

// -------------------------
// DOM helpers
// -------------------------
const $ = (id) => document.getElementById(id);

// Form e Inputs
const formBuscar = $('form-adicionar-projeto');
const inputIdProjeto = $('id-novo-projeto');
const overlay = $('loading-overlay');

// Seções de exibição
const boxInfoProjeto = $('project-info');
const sectionKPIs = $('kpi-principais');
const sectionOverview = $('project-overview');

// Dados principais
const infoId = $('info-id');
const infoCliente = $('info-cliente');
const infoData = $('info-data');
const infoStatus = $('info-status');

// KPIs
const kpiTotalProjeto = $('val-total-projeto');
const kpiKit = $('val-kit');
const kpiCustos = $('val-custos');
const kpiLucro = $('val-lucro');

// Overview
const ovId = $('overview-id');
const ovClient = $('overview-client');
const ovDate = $('overview-date');
const ovBreakMaterial = $('break-material');
const ovBreakDiarias = $('break-diarias');
const ovBreakComb = $('break-combustivel');
const ovBreakOutras = $('break-outras');
const ovValorProposta = $('overview-valor-proposta');
const ovMargem = $('overview-margem');

// Modal & editor
const modal = $('modal-edicao');
const btnAbrirModal = $('btn-open-editor');
const modalProjetoId = $('modal-projeto-id');

// Containers de itens
const listaMaterial = $('lista-material');
const listaDiarias = $('lista-diarias');
const listaDespProjeto = $('lista-despesas-projeto');
const listaDespFixas = $('lista-despesas-fixas-gerais');
const listaFerramenta = $('lista-ferramenta');

// Inputs específicos
const inputAlimentacao = $('input-alimentacao');
const inputQuilometragem = $('input-quilometragem');
const inputCombustivel = $('input-combustivel');
const inputValorProjetoHidden = $('input-valor-projeto');
const inputValorKitHidden = $('input-kit-fotovoltaico');

let projetoAtual = null;

// -------------------------
// Utilitários
// -------------------------
function log(...args) { console.log('[CONTROLLER]', ...args); }
function warn(...args) { console.warn('[CONTROLLER]', ...args); }
function error(...args) { console.error('[CONTROLLER]', ...args); }

function mostrarLoading(sim = true) {
  overlay?.classList.toggle('oculto', !sim);
}

function formatar(v) {
  try { return formatarMoeda(Number(v) || 0); } catch { return String(v ?? '0,00'); }
}

function formatarDataLocal(d) {
  try { return formatarData(d); } catch { return new Date(d).toLocaleDateString('pt-BR'); }
}

function abrirModal() { modal && (modal.style.display = 'flex'); }
window.fecharModal = () => { modal && (modal.style.display = 'none'); };

// -------------------------
// Parsing e criação de itens
// -------------------------
function parseLinhaFormatada(linha) {
  if (!linha || !linha.includes('|')) return null;
  const [desc, val] = linha.split('|').map(s => s.trim());
  const valorNum = Number(val.replace(',', '.')) || 0;
  return { descricao: desc, valor: valorNum };
}

function criarLinhaItem(descricao = '', valor = '', opts = {}) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.style = 'display:flex; gap:8px; align-items:center; margin-bottom:6px;';

  const inpDesc = document.createElement('input');
  inpDesc.type = 'text';
  inpDesc.className = 'input-descricao';
  inpDesc.placeholder = opts.placeholderDesc || 'Descrição';
  inpDesc.value = descricao;

  const inpVal = document.createElement('input');
  inpVal.type = 'number';
  inpVal.step = '0.01';
  inpVal.className = 'input-valor';
  inpVal.placeholder = opts.placeholderVal || '0.00';
  inpVal.value = (valor !== undefined && valor !== null) ? Number(valor).toFixed(2) : '';

  row.append(inpDesc, inpVal);

  if (opts.withFile) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.className = 'input-file';
    fileInput.multiple = !!opts.multiple;
    row.appendChild(fileInput);
  }

  const btnRem = document.createElement('button');
  btnRem.type = 'button';
  btnRem.className = 'btn-remover';
  btnRem.title = 'Remover item';
  btnRem.innerHTML = '✖';
  btnRem.onclick = () => { row.remove(); atualizarSomaModal(); };
  row.appendChild(btnRem);

  return row;
}

function criarLinhaItemExistente(item) {
  const row = document.createElement('div');
  row.className = 'item-row existente';
  row.style = 'display:flex; gap:8px; align-items:center; margin-bottom:6px;';

  const spanDesc = document.createElement('span');
  spanDesc.textContent = item.descricao || '';
  spanDesc.style.flex = '2';

  const spanVal = document.createElement('span');
  spanVal.textContent = (item.valor ?? 0).toFixed(2);
  spanVal.style.flex = '1';
  spanVal.style.textAlign = 'right';

  const btnEdit = document.createElement('button');
  btnEdit.type = 'button';
  btnEdit.textContent = '✎';
  btnEdit.title = 'Editar item';
  btnEdit.onclick = () => {
    row.innerHTML = '';
    const editableRow = criarLinhaItem(item.descricao, item.valor, { withFile: true });
    row.replaceWith(editableRow);
  };

  row.append(spanDesc, spanVal, btnEdit);
  return row;
}

function limparContainer(container) { if (container) container.innerHTML = ''; }

function popularListaComItens(container, itens = [], opts = {}) {
  if (!container) return;
  limparContainer(container);
  if (!itens.length) container.appendChild(criarLinhaItem('', '', opts));
  else itens.forEach(it => container.appendChild(criarLinhaItemExistente(it)));
}

function atualizarSomaModal() {
  const soma = (container) => {
    if (!container) return 0;
    let s = 0;
    container.querySelectorAll('.item-row').forEach(r => {
      const v = parseFloat(r.querySelector('.input-valor')?.value) || 0;
      s += v;
    });
    return s;
  };
  log('Somas (modal): mat', soma(listaMaterial), 'diarias', soma(listaDiarias), 'despProjeto', soma(listaDespProjeto), 'despFixas', soma(listaDespFixas), 'ferr', soma(listaFerramenta));
}

// -------------------------
// Coleta itens do modal / input
// -------------------------
function coletarItensDoContainer(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('.item-row')).map(row => {
    const descricao = row.querySelector('.input-descricao')?.value.trim() || '';
    const valor = parseFloat(row.querySelector('.input-valor')?.value) || 0;
    const arquivos = Array.from(row.querySelectorAll('.input-file')).flatMap(inp => inp.files ? Array.from(inp.files) : []);
    return { descricao, valor, arquivos };
  });
}

function coletarItensCombustivelDoInput(input) {
  if (!input) return [];
  return input.value.split('\n').map(parseLinhaParaItem).filter(Boolean);
}

// -------------------------
// SALVAR alterações
// -------------------------
window.lidarComEnvioEdicao = async function(e) {
  e?.preventDefault();
  if (!projetoAtual) return alert('Carregue um projeto primeiro.');

  try {
    mostrarLoading(true);

    const combustivelItens = coletarItensCombustivelDoInput(inputQuilometragem);
    const totalCombustivel = combustivelItens.reduce((s,i)=>s+(i.valor||0),0);

    const entrada = {
      material: coletarItensDoContainer(listaMaterial).map(i => ({ descricao: i.descricao, valor: i.valor })),
      diarias: coletarItensDoContainer(listaDiarias).map(i => ({ descricao: i.descricao, valor: i.valor })),
      despProjeto: coletarItensDoContainer(listaDespProjeto).map(i => ({ descricao: i.descricao, valor: i.valor })),
      despFixasGerais: coletarItensDoContainer(listaDespFixas).map(i => ({ descricao: i.descricao, valor: i.valor })),
      ferramenta: coletarItensDoContainer(listaFerramenta).map(i => ({ descricao: i.descricao, valor: i.valor })),
      totalAlimentacao: Number(inputAlimentacao?.value || 0),
      combustivelItens,
      totalCombustivel,
      quilometragem: inputQuilometragem?.value || '',
      valorProjeto: Number(inputValorProjetoHidden?.value || 0),
      valorKit: Number(inputValorKitHidden?.value || 0),
      valorIndicacao: 0
    };

    const dadosProcessados = processarEGerarPayload(entrada);
    const resposta = await atualizarMultiplosCampos(projetoAtual.id ?? projetoAtual.identifier, dadosProcessados, projetoAtual.fieldIds ?? projetoAtual.fieldIds);

    if (!resposta?.sucesso) return alert('Erro ao salvar alterações. Veja console.'), error('Falha ao atualizar campos:', resposta);

    log('Salvo com sucesso (dados numéricos/texto). Arquivos ficaram para upload manual/worker.');
    fecharModal();
    await buscarProjeto(projetoAtual.id ?? projetoAtual.identifier);

  } catch (err) {
    error('Erro ao salvar edição:', err);
    alert('Erro ao salvar alterações. Veja console.');
  } finally {
    mostrarLoading(false);
  }
};

// -------------------------
// BUSCAR projeto
// -------------------------
async function buscarProjeto(id) {
  if (!id) return;
  try {
    mostrarLoading(true);
    log('Buscando projeto', id);

    const dados = await buscarEProcessarProjeto(id);
    mostrarLoading(false);

    if (!dados) return alert(`Projeto #${id} não encontrado. Veja console.`);

    projetoAtual = dados;

    // preencher exibição
    preencherDadosProjeto(dados);
    preencherKPIs(dados);
    preencherOverview(dados);

    // Popular modal com itens já formatados do Solar Market
    const itens = dados.itens || {};
    const parseJsonItens = (rawItens) => rawItens.map(i => parseLinhaFormatada(i.value)).filter(Boolean);

    popularListaComItens(listaMaterial, parseJsonItens(itens.material || []), { withFile: true, multiple: true });
    popularListaComItens(listaDiarias, parseJsonItens(itens.diarias || []), { withFile: false });
    popularListaComItens(listaDespProjeto, parseJsonItens(itens.despProjeto || []), { withFile: true });
    popularListaComItens(listaDespFixas, parseJsonItens(itens.despFixasGerais || []), { withFile: true });
    popularListaComItens(listaFerramenta, parseJsonItens(itens.ferramenta || []), { withFile: true });

    inputAlimentacao && (inputAlimentacao.value = Number(dados.rawFields?.[KEYS.CUSTO_ALIMENTACAO] ?? dados.totais?.diarias_mo ?? 0));
    inputCombustivel && (inputCombustivel.value = Number(dados.rawFields?.[KEYS.CUSTO_COMBUSTIVEL] ?? dados.totais?.combustivel ?? 0));
    if (inputQuilometragem) inputQuilometragem.value = (dados.itens?.combustivel || []).map(formatCombustivelParaLinha).join('\n');

    inputValorProjetoHidden && (inputValorProjetoHidden.value = Number(dados.rawFields?.[KEYS.VALOR_TOTAL_PROJETO] ?? dados.valorProposta ?? 0));
    inputValorKitHidden && (inputValorKitHidden.value = Number(dados.rawFields?.[KEYS.VALOR_KIT_FOTOVOLTAICO] ?? 0));

    boxInfoProjeto?.classList.remove('oculto');
    sectionKPIs?.classList.remove('oculto');
    sectionOverview?.classList.remove('oculto');

    log(`Projeto #${id} carregado e renderizado.`);

  } catch (err) {
    mostrarLoading(false);
    error('Erro ao buscar projeto:', err);
    alert('Erro ao buscar projeto. Veja console.');
  }
}

// -------------------------
// Eventos
// -------------------------
formBuscar?.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = parseInt(inputIdProjeto?.value, 10);
  if (!id || isNaN(id)) return alert('Informe um ID válido.');
  buscarProjeto(id);
});

btnAbrirModal?.addEventListener('click', () => {
  if (!projetoAtual) return alert('Carregue um projeto antes de editar.');
  modalProjetoId.textContent = projetoAtual.id ?? projetoAtual.identifier ?? '';
  abrirModal();
  atualizarSomaModal();
});

log('Controller (versão refatorada com modal profissional e itens existentes) carregado.');
