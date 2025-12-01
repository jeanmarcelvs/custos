import {
  buscarEProcessarProjeto,
  atualizarMultiplosCampos,
  KEYS
} from './model.js';

import { formatarMoeda, formatarData, parseLinhaParaItem, formatCombustivelParaLinha } from './utils.js';

/**
 * Atalho para document.getElementById.
 * @param {string} id O ID do elemento.
 * @returns {HTMLElement | null}
 */
const $ = (id) => document.getElementById(id);

// --- Seletores do DOM ---
const formBuscar = $('form-adicionar-projeto');
const inputIdProjeto = $('id-novo-projeto');
const overlay = $('loading-overlay');

const boxInfoProjeto = $('project-info');
const sectionKPIs = $('kpi-principais');
const sectionOverview = $('project-overview');

const modal = $('modal-edicao');
const btnAbrirModal = $('btn-open-editor');
const modalProjetoId = $('modal-projeto-id');

const listaMaterial = $('lista-material');
const listaDiarias = $('lista-diarias');
const listaDespProjeto = $('lista-despesas-projeto');
const listaDespFixas = $('lista-despesas-fixas-gerais');
const listaFerramenta = $('lista-ferramenta');

const inputAlimentacao = $('input-alimentacao');
const inputQuilometragem = $('input-quilometragem');
const inputCombustivel = $('input-combustivel');
const inputValorProjetoHidden = $('input-valor-projeto');
const inputValorKitHidden = $('input-kit-fotovoltaico');

// --- Estado da Aplicação ---
let projetoAtual = null;

/**
 * Exibe ou oculta a tela de carregamento.
 * @param {boolean} [mostrar=true] - True para exibir, false para ocultar.
 */
function mostrarLoading(sim = true) {
  overlay?.classList.toggle('oculto', !sim);
}

/**
 * Abre o modal de edição.
 */
function abrirModal() { modal && (modal.style.display = 'flex'); }

/**
 * Fecha o modal de edição (exposto globalmente para o botão no HTML).
 */
window.fecharModal = () => { modal && (modal.style.display = 'none'); };

/**
 * Cria um elemento de linha de item editável para o modal.
 * @param {string} [descricao=''] - A descrição inicial do item.
 * @param {number | string} [valor=''] - O valor inicial do item.
 * @returns {HTMLDivElement} O elemento da linha.
 */
function criarLinhaItem(descricao = '', valor = '') {
  const row = document.createElement('div');
  row.className = 'item-row';

  const inpDesc = document.createElement('input');
  inpDesc.type = 'text';
  inpDesc.className = 'input-descricao';
  inpDesc.placeholder = 'Descrição';
  inpDesc.value = descricao;

  const inpVal = document.createElement('input');
  inpVal.type = 'number';
  inpVal.step = '0.01';
  inpVal.className = 'input-valor';
  inpVal.placeholder = '0.00';
  inpVal.value = (valor !== undefined && valor !== null) ? Number(valor).toFixed(2) : '';

  row.append(inpDesc, inpVal);

  const btnRem = document.createElement('button');
  btnRem.type = 'button';
  btnRem.className = 'btn-remover';
  btnRem.title = 'Remover item';
  btnRem.innerHTML = '✖';
  btnRem.onclick = () => row.remove();
  row.appendChild(btnRem);

  return row;
}

/**
 * Popula um container no modal com itens existentes.
 * @param {HTMLElement} container - O elemento container da lista.
 * @param {Array<object>} [itens=[]] - A lista de itens a serem exibidos.
 */
function popularListaComItens(container, itens = []) {
  if (!container) return;
  container.innerHTML = '';
  if (!itens.length) {
    container.appendChild(criarLinhaItem());
  } else {
    itens.forEach(item => container.appendChild(criarLinhaItem(item.descricao, item.valor)));
  }
}

/**
 * Coleta os dados dos itens de um container no modal.
 * @param {HTMLElement} container - O elemento container da lista.
 * @returns {Array<{descricao: string, valor: number}>}
 */
function coletarItensDoContainer(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('.item-row')).map(row => {
    const descricao = row.querySelector('.input-descricao')?.value.trim() || '';
    const valor = parseFloat(row.querySelector('.input-valor')?.value) || 0;
    return { descricao, valor };
  }).filter(item => item.descricao || item.valor > 0);
}

/**
 * Manipula o envio do formulário de edição do modal.
 * @param {Event} e - O evento de submit.
 */
window.lidarComEnvioEdicao = async function(e) {
  e?.preventDefault();
  if (!projetoAtual) return alert('Carregue um projeto primeiro.');

  try {
    mostrarLoading(true);

    const payload = {
      material: coletarItensDoContainer(listaMaterial),
      diarias: coletarItensDoContainer(listaDiarias),
      despProjeto: coletarItensDoContainer(listaDespProjeto),
      despFixasGerais: coletarItensDoContainer(listaDespFixas),
      ferramenta: coletarItensDoContainer(listaFerramenta),
      combustivelTexto: inputQuilometragem?.value || '',
      // Adicionar outros campos se necessário
    };

    const resposta = await atualizarMultiplosCampos(projetoAtual.id, payload, projetoAtual.fieldIds);

    if (!resposta?.sucesso) {
      alert('Erro ao salvar alterações. Veja console.');
      console.error('Falha ao atualizar campos:', resposta);
      return;
    }

    alert('Alterações salvas com sucesso!');
    fecharModal();
    await buscarProjeto(projetoAtual.id);

  } catch (err) {
    console.error('Erro ao salvar edição:', err);
    alert('Erro ao salvar alterações. Veja console.');
  } finally {
    mostrarLoading(false);
  }
};

/**
 * Busca e renderiza os dados de um projeto na página.
 * @param {string | number} id - O ID do projeto a ser buscado.
 */
async function buscarProjeto(id) {
  if (!id) return;
  try {
    mostrarLoading(true);
    const dados = await buscarEProcessarProjeto(id);
    if (!dados) {
      alert(`Projeto #${id} não encontrado. Veja console.`);
      return;
    }
    projetoAtual = dados;

    renderizarPagina(dados);
    popularModal(dados);

  } catch (err) {
    console.error('Erro ao buscar projeto:', err);
    alert('Erro ao buscar projeto. Veja console.');
  } finally {
    mostrarLoading(false);
  }
}

/**
 * Preenche a página principal com os dados do projeto.
 * @param {object} dados - O objeto do projeto.
 */
function renderizarPagina(dados) {
  // Preenche informações básicas
  $('info-id').textContent = `#${dados.id}`;
  $('info-cliente').textContent = dados.nomeCliente;
  $('info-data').textContent = formatarData(dados.dataCriacao);
  $('info-status').textContent = dados.status;

  // Preenche KPIs
  $('val-total-projeto').textContent = formatarMoeda(dados.valorProposta);
  $('val-kit').textContent = formatarMoeda(dados.valorKit);
  $('val-custos').textContent = formatarMoeda(dados.totais.totalGeral);
  const lucro = dados.valorProposta - dados.valorKit - dados.totais.totalGeral;
  $('val-lucro').textContent = formatarMoeda(lucro);

  // Preenche Overview
  $('overview-id').textContent = `#${dados.id}`;
  $('overview-client').textContent = dados.nomeCliente;
  $('overview-date').textContent = formatarData(dados.dataCriacao);
  $('break-material').textContent = formatarMoeda(dados.totais.material);
  $('break-diarias').textContent = formatarMoeda(dados.totais.diarias);
  $('break-combustivel').textContent = formatarMoeda(dados.totais.combustivel);
  $('break-outras').textContent = formatarMoeda(dados.totais.outras);
  $('overview-valor-proposta').textContent = formatarMoeda(dados.valorProposta);
  const margem = dados.valorProposta > 0 ? (lucro / dados.valorProposta) * 100 : 0;
  $('overview-margem').textContent = `${margem.toFixed(2)}%`;

  // Exibe as seções
  boxInfoProjeto?.classList.remove('oculto');
  sectionKPIs?.classList.remove('oculto');
  sectionOverview?.classList.remove('oculto');
}

/**
 * Popula o modal de edição com os dados do projeto.
 * @param {object} dados - O objeto do projeto.
 */
function popularModal(dados) {
  const { itens, totais, rawFields, valorProposta, valorKit } = dados;

  popularListaComItens(listaMaterial, itens.material);
  popularListaComItens(listaDiarias, itens.diarias);
  popularListaComItens(listaDespProjeto, itens.despProjeto);
  popularListaComItens(listaDespFixas, itens.despFixasGerais);
  popularListaComItens(listaFerramenta, itens.ferramenta);

  if (inputAlimentacao) inputAlimentacao.value = totais.alimentacao || 0;
  if (inputCombustivel) inputCombustivel.value = totais.combustivel || 0;
  if (inputQuilometragem) inputQuilometragem.value = (itens.combustivel || []).map(formatCombustivelParaLinha).join('\n');

  if (inputValorProjetoHidden) inputValorProjetoHidden.value = valorProposta;
  if (inputValorKitHidden) inputValorKitHidden.value = valorKit;
}

/**
 * Inicializa os event listeners da página.
 */
function init() {
  formBuscar?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = parseInt(inputIdProjeto?.value, 10);
    if (!id || isNaN(id)) return alert('Informe um ID de projeto válido.');
    buscarProjeto(id);
  });

  btnAbrirModal?.addEventListener('click', () => {
    if (!projetoAtual) return alert('Carregue um projeto antes de editar.');
    modalProjetoId.textContent = projetoAtual.id;
    abrirModal();
  });

  console.log('Controller inicializado.');
}

// Inicia a aplicação
init();
