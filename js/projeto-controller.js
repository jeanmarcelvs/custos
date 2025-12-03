import { getMe, buscarEProcessarProjeto } from './model.js';
import { formatarMoeda, formatarData } from './utils.js';

/**
 * Atalho para document.getElementById.
 * @param {string} id O ID do elemento.
 * @returns {HTMLElement | null}
 */
const $ = (id) => document.getElementById(id);

// --- Estado da Aplicação ---
let projetoAtual = null;

// --- Seletores do DOM ---
const projectSearchContainer = $('project-search-container');
const projectDetailsContainer = $('project-details-container');
const loadingOverlay = $('loading-overlay');

// Elementos da tela de busca
const projectSearchForm = $('project-search-form');
const projectIdInput = $('project-id-input');
const usernameSearchSpan = $('username-search');
const usernameDetailsSpan = $('username-details');
const btnLogoutSearch = $('btn-logout-search');

// Elementos da tela de detalhes
const btnLogoutDetails = $('btn-logout');
const btnSearchPage = $('btn-search-page');
const btnEditPage = $('btn-edit-page');

/**
 * Exibe ou oculta a tela de carregamento.
 * @param {boolean} [mostrar=true] - True para exibir, false para ocultar.
 */
function mostrarLoading(mostrar = true) {
    loadingOverlay?.classList.toggle('oculto', !mostrar);
}

/**
 * Realiza o logout do usuário, limpando o localStorage e redirecionando para o login.
 */
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    window.location.href = 'index.html';
}

/**
 * Exibe o nome do usuário na interface.
 */
function displayUsername() {
    const username = localStorage.getItem('username');
    if (username) {
        if (usernameSearchSpan) usernameSearchSpan.textContent = username;
        if (usernameDetailsSpan) usernameDetailsSpan.textContent = username;
    }
}

/**
 * Preenche a tela de detalhes com os dados do projeto.
 * @param {object} dados - O objeto do projeto processado.
 */
function renderProjectDetails(dados) {
    // Cabeçalho
    $('proj-title').textContent = `Projeto #${dados.id}`;
    $('client-name-placeholder').textContent = dados.nomeCliente;
    $('info-data').textContent = formatarData(dados.dataCriacao);

    // KPIs Principais
    // Limpa classes de cor antigas e aplica as novas
    const setKpiClass = (elementId, className) => {
        const kpiElement = $(elementId)?.parentElement;
        if (kpiElement) {
            kpiElement.className = 'kpi'; // Reseta para a classe base
            kpiElement.classList.add(className);
            // Aplica a cor cinza diretamente se a classe for 'kpi-neutral'
            if (className === 'kpi-neutral') {
                const valueElement = kpiElement.querySelector('.value');
                if (valueElement) valueElement.style.color = '#9fa6b2'; // Cinza claro para de-emphasize
            }
        }
    };

    $('val-total-projeto').textContent = formatarMoeda(dados.valorProposta);
    $('val-kit').textContent = formatarMoeda(dados.valorKit);
    $('val-gdis').textContent = formatarMoeda(dados.valorProposta - dados.valorKit);
    $('val-custos').textContent = formatarMoeda(dados.totais.totalGeral);
    
    const lucroBruto = dados.valorProposta - dados.valorKit - dados.totais.totalGeral;
    $('val-lucro-sem-imposto').textContent = formatarMoeda(lucroBruto);
    $('val-imposto').textContent = formatarMoeda(dados.imposto.valor);
    $('val-lucro-com-imposto').textContent = formatarMoeda(lucroBruto - dados.imposto.valor);

    // Aplica as classes de cor aos KPIs
    setKpiClass('val-total-projeto', 'kpi-neutral');
    setKpiClass('val-kit', 'kpi-neutral');
    setKpiClass('val-gdis', 'kpi-gdis');
    setKpiClass('val-custos', 'kpi-cost');
    setKpiClass('val-lucro-sem-imposto', 'kpi-lucro-bruto');
    setKpiClass('val-imposto', 'kpi-cost');
    setKpiClass('val-lucro-com-imposto', 'kpi-profit-good');

    // Resumo de Custos
    $('break-material').textContent = formatarMoeda(dados.totais.material);
    $('break-diarias').textContent = formatarMoeda(dados.totais.diarias);
    $('break-combustivel').textContent = formatarMoeda(dados.totais.combustivel);
    $('break-outras').textContent = formatarMoeda(dados.totais.outras);

    // Renderiza a seção de documentos do projeto
    renderProjectDocuments(dados);

    // Alterna a visibilidade dos containers
    projectSearchContainer.classList.add('oculto');
    projectDetailsContainer.classList.remove('oculto');
}

/**
 * Extrai o nome real e amigável de um arquivo de uma URL que contém um prefixo gerado pelo sistema.
 * O padrão esperado da URL é: PREFIXO_VARIAVEL#-NOME_REAL_DO_ARQUIVO.EXTENSAO
 * Ex: 2025-12-03_14-10-50_82r#-UNIFILAR-Nilceia.pdf -> UNIFILAR-Nilceia.pdf
 *
 * @param {string} url - A URL completa do arquivo.
 * @returns {string} O nome amigável do arquivo, ou a URL original como fallback.
 */
function extrairNomeRobusto(url) {
    // 1. Decodifica a URL para tratar caracteres como 'ç', espaços (%20), etc.
    const urlDecodificada = decodeURIComponent(url);

    // 2. Remove o caminho, se houver, pegando apenas o nome do arquivo.
    // Ex: "https://sc-erp.s3.amazonaws.com/path/to/file.pdf" -> "file.pdf"
    const nomeComPrefixo = urlDecodificada.split('/').pop();

    // 3. Define o delimitador que separa o prefixo do nome real do arquivo.
    const delimitador = '#-';

    // 4. Divide a string no delimitador.
    const partes = nomeComPrefixo.split(delimitador);

    // 5. Se o delimitador foi encontrado, retorna a segunda parte (o nome real).
    //    Caso contrário, retorna o nome do arquivo extraído da URL como fallback.
    return (partes.length > 1) ? partes[1] : nomeComPrefixo;
}

/**
 * Renderiza a lista de documentos do projeto a partir de um campo customizado.
 * @param {object} dados - O objeto do projeto processado.
 */
function renderProjectDocuments(dados) {
    const container = $('documentos-projeto-container');
    const listElement = $('documentos-projeto-list');
    if (!container || !listElement) return;

    // Limpa a lista e oculta o container por padrão
    listElement.innerHTML = '';
    container.classList.add('oculto');

    // Obtém a string bruta de URLs do campo customizado '[cap_doc_projeto]'
    const docUrlsString = dados.rawFields['[cap_doc_projeto]'];

    if (docUrlsString) {
        // Divide a string por nova linha para obter URLs individuais
        const urls = docUrlsString.split('\n').map(url => url.trim()).filter(url => url !== '');

        if (urls.length > 0) {
            urls.forEach(url => {
                const item = document.createElement('a');
                item.href = url;
                item.target = '_blank'; // Abre em nova aba
                item.rel = 'noopener noreferrer';
                item.className = 'document-item'; // Para estilização futura
                // Usa a nova função para extrair o nome amigável do arquivo
                const filename = extrairNomeRobusto(url);
                item.innerHTML = `<i class="fas fa-file-alt"></i> <span>${filename || 'Documento'}</span>`;
                listElement.appendChild(item);
            });
            container.classList.remove('oculto'); // Mostra o container se houver documentos
        }
    }
}

/**
 * Busca os dados de um projeto na API e renderiza na tela.
 * @param {string} projectId - O ID do projeto.
 */
async function fetchAndRenderProject(projectId) {
    mostrarLoading(true);
    try {
        const dados = await buscarEProcessarProjeto(projectId);
        if (!dados) {
            alert(`Projeto #${projectId} não encontrado ou falha ao carregar.`);
            // Volta para a tela de busca se o projeto não for encontrado
            window.history.replaceState({}, document.title, window.location.pathname);
            projectDetailsContainer.classList.add('oculto');
            projectSearchContainer.classList.remove('oculto');
            return;
        }
        projetoAtual = dados;
        renderProjectDetails(dados);

        // Atualiza a URL sem recarregar a página
        const url = new URL(window.location);
        url.searchParams.set('projectId', projectId);
        window.history.pushState({}, '', url);

    } catch (error) {
        console.error('Erro ao buscar e renderizar projeto:', error);
        alert('Ocorreu um erro ao carregar o projeto. Verifique o console.');
    } finally {
        mostrarLoading(false);
    }
}

/**
 * Verifica a sessão do usuário e decide qual tela mostrar.
 */
async function checkSessionAndInitialize() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        logout(); // Se não há token, força o logout
        return;
    }

    try {
        // Valida o token com a API
        const userData = await getMe();
        if (!userData.sucesso) {
            throw new Error('Sessão inválida ou expirada.');
        }

        // Exibe o nome do usuário
        displayUsername();

        // Lógica para decidir qual tela mostrar (busca ou detalhes)
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get('projectId');

        if (projectId) {
            // Se houver um projectId na URL, busca e renderiza os dados
            await fetchAndRenderProject(projectId);
        } else {
            // Senão, mostra a tela de busca
            projectSearchContainer.classList.remove('oculto');
        }

    } catch (error) {
        console.error('Erro de sessão:', error);
        logout();
    }
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    btnLogoutSearch.addEventListener('click', logout);
    btnLogoutDetails.addEventListener('click', logout);

    projectSearchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const projectId = projectIdInput.value.trim();
        if (projectId) {
            fetchAndRenderProject(projectId);
        }
    });

    btnSearchPage.addEventListener('click', () => {
        window.history.pushState({}, '', 'projeto.html');
        projectDetailsContainer.classList.add('oculto');
        projectSearchContainer.classList.remove('oculto');
        projectIdInput.value = '';
        projectIdInput.focus();
    });

    btnEditPage.addEventListener('click', () => {
        if (projetoAtual) {
            // Armazena os dados do projeto na sessão para evitar uma nova busca na página de edição
            sessionStorage.setItem('projetoParaEdicao', JSON.stringify(projetoAtual));
            window.location.href = `editar-projeto.html?projectId=${projetoAtual.id}`;
        }
    });

    checkSessionAndInitialize();
});