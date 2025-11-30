// js/projeto-controller.js

import { buscarEProcessarProjeto } from './model.js';
import { formatarMoeda } from './utils.js';

function $(id) { return document.getElementById(id); }

// Verifica se o usuário está logado, caso contrário, redireciona para o login
if (!localStorage.getItem('authToken')) {
  window.location.href = 'index.html';
}

const params = new URLSearchParams(location.search);
const projectId = params.get('projectId');
const overlay = $('loading-overlay');

// Elementos da página
const projectSearchContainer = $('project-search-container');
const projectDetailsContainer = $('project-details-container');
const projectSearchForm = $('project-search-form');

function mostrarLoading(sim = true) {
  overlay?.classList.toggle('oculto', !sim);
}

async function carregar(id) {
  if (!id) {
    // Se não há ID, mostra a busca e esconde os detalhes
    projectDetailsContainer?.classList.add('oculto');
    projectSearchContainer?.classList.remove('oculto');

    // Adiciona o listener para o formulário de busca
    projectSearchForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const newProjectId = $('project-id-input').value;
      if (newProjectId) {
        window.location.href = `projeto.html?projectId=${encodeURIComponent(newProjectId)}`;
      }
    });
    return;
  }

  mostrarLoading(true);

  try {
    const dados = await buscarEProcessarProjeto(id);
    // Se chegou aqui com um ID, esconde a busca e mostra os detalhes
    projectDetailsContainer?.classList.remove('oculto');
    projectSearchContainer?.classList.add('oculto');

    if (!dados) {
      alert('Erro ao carregar projeto. Veja console.');
      $('client-name-placeholder').textContent = `Projeto #${id} não encontrado.`;
      return;
    }

    $('proj-title').innerHTML += `<span class="project-id-tag">#${dados.id}</span>`;
    $('client-name-placeholder').textContent = dados.nomeCliente ?? 'Cliente não informado';
    $('info-data').textContent = new Date(dados.dataCriacao).toLocaleDateString('pt-BR');

    // Valores principais
    $('val-total-projeto').textContent = formatarMoeda(Number(dados.valorProposta ?? 0));
    const valorKit = Number(dados.valorKit ?? 0);
    $('val-kit').textContent = formatarMoeda(valorKit);

    // Lógica de cálculo atualizada
    const valorProposta = Number(dados.valorProposta ?? 0);
    const valorGDIS = valorProposta - valorKit; // Valor GDIS = Total - Kit
    const totalCustos = Number(dados.totais?.totalGeral ?? 0);
    const valorImposto = valorGDIS * 0.12; // Imposto é 12% sobre o valor GDIS
    const percentualImposto = valorGDIS > 0 ? (valorImposto / valorGDIS) * 100 : 0;

    const lucroSemImposto = valorGDIS - totalCustos; // Lucro bruto é sobre o valor GDIS
    const lucroComImposto = lucroSemImposto - valorImposto;

    // Atualiza os valores no DOM
    $('val-gdis').textContent = formatarMoeda(valorGDIS);
    $('val-custos').textContent = formatarMoeda(totalCustos);
    $('val-imposto').textContent = `${formatarMoeda(valorImposto)} (${percentualImposto.toFixed(1)}%)`;
    $('val-lucro-sem-imposto').textContent = formatarMoeda(lucroSemImposto);
    $('val-lucro-com-imposto').textContent = formatarMoeda(lucroComImposto);

    // Aplica estilo ao card de CUSTOS
    $('val-custos').closest('.kpi').classList.add('kpi-cost');
    $('val-imposto').closest('.kpi').classList.add('kpi-cost');

    // Lógica condicional para o card de LUCRO COM IMPOSTO
    const kpiLucroCard = $('val-lucro-com-imposto').closest('.kpi');
    kpiLucroCard.classList.remove('kpi-profit-good', 'kpi-profit-warning', 'kpi-profit-bad'); // Limpa classes antigas

    // A margem de lucro agora é calculada sobre o valor GDIS
    const margemDeLucro = valorGDIS > 0 ? (lucroComImposto / valorGDIS) * 100 : 0;

    if (margemDeLucro > 17) {
      kpiLucroCard.classList.add('kpi-profit-good');
    } else if (margemDeLucro >= 13) {
      kpiLucroCard.classList.add('kpi-profit-warning');
    } else {
      kpiLucroCard.classList.add('kpi-profit-bad');
    }
    // O lucro sem imposto pode ter uma cor neutra ou de sucesso, dependendo da sua preferência.
    // Vamos deixar neutro por enquanto.

    $('break-material').textContent = formatarMoeda(Number(dados.totais?.material ?? 0));
    $('break-diarias').textContent = formatarMoeda(Number(dados.totais?.diarias ?? 0));
    $('break-combustivel').textContent = formatarMoeda(Number(dados.totais?.combustivel ?? 0));
    $('break-outras').textContent = formatarMoeda(Number(dados.totais?.outras ?? 0));

  } catch (e) {
    $('client-name-placeholder').textContent = 'Falha ao carregar dados.';
    console.error(e);
    alert('Erro ao carregar projeto. Veja console.');
  } finally {
    mostrarLoading(false);
  }
}

document.getElementById('btn-edit-page').addEventListener('click', () => {
  if (!projectId) return alert('Nenhum projeto selecionado.');
  window.location.href = `editar-projeto.html?projectId=${encodeURIComponent(projectId)}`;
});

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('authToken');
  window.location.href = 'index.html';
});

// NOVO: Adiciona o listener para o botão de logout na tela de busca
document.getElementById('btn-logout-search').addEventListener('click', () => {
  localStorage.removeItem('authToken');
  window.location.href = 'index.html';
});

document.getElementById('btn-refresh').addEventListener('click', () => location.reload());

// inicializa
carregar(projectId);