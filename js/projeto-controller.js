import { getMe, buscarEProcessarProjeto } from './model.js';
import { formatarMoeda, formatarData } from './utils.js';

const $ = (id) => document.getElementById(id);

// --- Estado ---
let projetoAtual = null;

// --- Containers ---
const projectSearchContainer = $('project-search-container');
const projectDetailsContainer = $('project-details-container');
const loadingOverlay = $('loading-overlay');

// --- Busca ---
const projectSearchForm = $('project-search-form');
const projectIdInput = $('project-id-input');
const usernameSearchSpan = $('username-search');
const usernameDetailsSpan = $('username-details');
const btnLogoutSearch = $('btn-logout-search');
let isAdministrator = false;

// --- Detalhes ---
const btnLogoutDetails = $('btn-logout');
const btnSearchPage = $('btn-search-page');
const btnEditPage = $('btn-edit-page');
const btnReportPage = $('btn-report-page');

/* =========================
   HELPERS
========================= */
function mostrarLoading(show = true) {
    loadingOverlay?.classList.toggle('oculto', !show);
}

function logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'index.html';
}

/* =========================
   RENDER
========================= */
function renderProjectDetails(dados) {
    $('proj-title').textContent = `Projeto #${dados.id}`;
    $('client-name-placeholder').textContent = dados.cliente ?? '—';
    $('info-data').textContent = formatarData(dados.meta?.createdAt);

    const totalCustos = dados.totais?.totalGeral ?? 0;
    const valorKit = dados.valorKit ?? 0;
    const valorProposta = dados.valorProposta ?? 0;

    const lucroBruto = valorProposta - valorKit - totalCustos;

    $('val-total-projeto').textContent = formatarMoeda(valorProposta);
    $('val-kit').textContent = formatarMoeda(valorKit);
    $('val-gdis').textContent = formatarMoeda(valorProposta - valorKit);
    $('val-custos').textContent = formatarMoeda(totalCustos);
    $('val-lucro-sem-imposto').textContent = formatarMoeda(lucroBruto);

    // Imposto defensivo
    const impostoValor = dados.imposto?.valor ?? 0;
    $('val-imposto').textContent = formatarMoeda(impostoValor);
    $('val-lucro-com-imposto').textContent = formatarMoeda(lucroBruto - impostoValor);

    // Restaura a aplicação de classes CSS para coloração dos cards (KPIs)
    const setKpiClass = (elementId, className) => {
        const element = $(elementId);
        if (element && element.parentElement) {
            element.parentElement.className = `kpi ${className}`;
            if (className === 'kpi-neutral') {
                element.parentElement.classList.add('kpi-neutral-bg');
            }
        }
    };

    setKpiClass('val-total-projeto', 'kpi-neutral');
    setKpiClass('val-kit', 'kpi-neutral');
    setKpiClass('val-gdis', 'kpi-gdis');
    setKpiClass('val-custos', 'kpi-cost');
    setKpiClass('val-lucro-sem-imposto', 'kpi-lucro-bruto');
    setKpiClass('val-imposto', 'kpi-cost');
    setKpiClass('val-lucro-com-imposto', 'kpi-profit-good');

    // Breakdown
    $('break-material').textContent = formatarMoeda(dados.totais?.material ?? 0);
    $('break-diarias').textContent = formatarMoeda(dados.totais?.diarias ?? 0);
    $('break-combustivel').textContent = formatarMoeda(dados.totais?.combustivel ?? 0);

    // "Outras" = tudo menos material/diária/combustível
    const outras =
        totalCustos -
        (dados.totais?.material ?? 0) -
        (dados.totais?.diarias ?? 0) -
        (dados.totais?.combustivel ?? 0);

    $('break-outras').textContent = formatarMoeda(Math.max(0, outras));

    projectSearchContainer.classList.add('oculto');
    projectDetailsContainer.classList.remove('oculto');
}

/* =========================
   FETCH
========================= */
async function fetchAndRenderProject(projectId) {
    mostrarLoading(true);
    try {
        const dados = await buscarEProcessarProjeto(projectId);
        projetoAtual = dados;
        renderProjectDetails(dados);

        const url = new URL(window.location);
        url.searchParams.set('projectId', projectId);
        history.pushState({}, '', url);
    } catch (err) {
        console.error(err);

        if (err.status === 401) {
            alert('Sessão expirada');
            logout();
        } else if (err.status === 403) {
            alert('Você não tem permissão para acessar este projeto.');
        } else {
            alert('Projeto não encontrado.');
        }

        projectDetailsContainer.classList.add('oculto');
        projectSearchContainer.classList.remove('oculto');
    } finally {
        mostrarLoading(false);
    }
}

/* =========================
   SESSION
========================= */
async function checkSessionAndInitialize() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        logout();
        return;
    }

    try {
        const me = await getMe();
        if (!me?.sucesso) throw new Error();

        isAdministrator = me.user?.admin;
        const email = me.user?.email;
        const username = email ? email.split('@')[0] : '';
        usernameSearchSpan.textContent = username;
        usernameDetailsSpan.textContent = username;

        const projectId = new URLSearchParams(window.location.search).get('projectId');
        if (projectId) {
            if (!isAdministrator) {
                btnReportPage.textContent = 'Relatório';
            } else {
                btnReportPage.textContent = 'Relatório';
            }
            await fetchAndRenderProject(projectId);
        } else {
            projectSearchContainer.classList.remove('oculto');
        }
    } catch {
        logout();
    }
}

/* =========================
   INIT
========================= */
document.addEventListener('DOMContentLoaded', () => {
    btnLogoutSearch?.addEventListener('click', logout);
    btnLogoutDetails?.addEventListener('click', logout);

    projectSearchForm?.addEventListener('submit', e => {
        e.preventDefault();
        if (projectIdInput.value.trim()) {
            fetchAndRenderProject(projectIdInput.value.trim());
        }
    });

    btnSearchPage?.addEventListener('click', () => {
        history.pushState({}, '', 'projeto.html');
        projectDetailsContainer.classList.add('oculto');
        projectSearchContainer.classList.remove('oculto');
    });

    btnEditPage?.addEventListener('click', () => {
        if (projetoAtual) {
            sessionStorage.setItem('projetoParaEdicao', JSON.stringify(projetoAtual));
            window.location.href = `editar-projeto.html?projectId=${projetoAtual.id}`;
        }
    });

    btnReportPage?.addEventListener('click', () => {
        if (projetoAtual && !isAdministrator) {
            window.location.href = `relatorio-simplificado.html?projectId=${projetoAtual.id}`;

        }
        else if (projetoAtual && isAdministrator) {
            window.location.href = `relatorio-projeto.html?projectId=${projetoAtual.id}`;
        }
    });

    checkSessionAndInitialize();
});