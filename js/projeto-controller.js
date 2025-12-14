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
const lightboxState = {
    imageUrls: [],
    currentIndex: 0,
    isZoomed: false, // Novo estado para controlar o zoom
};

// --- Seletores do DOM (Lightbox) ---
const lightbox = $('image-lightbox');
const lightboxImage = $('lightbox-image');
const lightboxClose = $('lightbox-close');
const lightboxPrev = $('lightbox-prev'); // Adicionado lightboxMainArea e lightboxImageWrapper
const lightboxMainArea = lightbox ? lightbox.querySelector('.lightbox-main-area') : null; // Novo seletor
const lightboxImageWrapper = lightbox ? lightbox.querySelector('.lightbox-image-wrapper') : null; // Novo seletor
const lightboxNext = $('lightbox-next');
const lightboxDownload = $('lightbox-download');

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
            kpiElement.className = 'kpi'; // Reseta para a classe base, removendo cores antigas
            kpiElement.classList.add(className);
            if (className === 'kpi-neutral') {
                kpiElement.classList.add('kpi-neutral-bg'); // Adiciona a classe para o fundo transparente
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
 * Funções do Lightbox
 */
function openLightbox(index) { // Adicionado lightboxMainArea e lightboxImageWrapper
    if (!lightbox || !lightboxMainArea || !lightboxImageWrapper) return; // Adicionado lightboxMainArea e lightboxImageWrapper
    lightboxState.currentIndex = index;
    lightboxState.isZoomed = false; // Reseta o zoom ao abrir uma nova imagem
    updateLightboxContent();
    lightbox.classList.remove('oculto');
    document.addEventListener('keydown', handleKeyboardNav);
}

function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.add('oculto');
    lightboxImage.src = ''; // Limpa a imagem para liberar memória
    document.removeEventListener('keydown', handleKeyboardNav);
}

function showNextImage() {
    if (lightboxState.currentIndex < lightboxState.imageUrls.length - 1) {
        lightboxState.currentIndex++;
        updateLightboxContent();
    }
}

function showPrevImage() {
    if (lightboxState.currentIndex > 0) {
        lightboxState.currentIndex--;
        updateLightboxContent();
    }
}

function updateLightboxContent() {
    const imageUrl = lightboxState.imageUrls[lightboxState.currentIndex];
    const fileName = extrairNomeRobusto(imageUrl);

    // Atualiza a imagem e o link de download
    lightboxImage.src = imageUrl;
    lightboxDownload.href = imageUrl;
    lightboxDownload.download = fileName; // Sugere o nome correto do arquivo para download

    // Aplica/remove a classe 'zoomed' no wrapper da imagem
    if (lightboxState.isZoomed) {
        lightboxImageWrapper.classList.add('zoomed');
    } else {
        lightboxImageWrapper.classList.remove('zoomed');
        // Reseta a posição de rolagem quando o zoom é desativado
        lightboxImageWrapper.scrollTop = 0;
        lightboxImageWrapper.scrollLeft = 0;
    }

    // Controla a visibilidade dos botões de navegação (prev/next)
    lightboxPrev.classList.toggle('oculto', lightboxState.imageUrls.length <= 1 || lightboxState.currentIndex === 0);
    lightboxNext.classList.toggle('oculto', lightboxState.imageUrls.length <= 1 || lightboxState.currentIndex === lightboxState.imageUrls.length - 1); // Adicionado lightboxMainArea e lightboxImageWrapper
}

function toggleZoom(e) {
    e.stopPropagation(); // Impede que o clique se propague para o overlay e feche o lightbox
    if (!lightboxImageWrapper) return;
    lightboxState.isZoomed = !lightboxState.isZoomed;
    updateLightboxContent();
}

function handleKeyboardNav(e) {
    if (e.key === 'Escape') {
        closeLightbox();
    } else if (e.key === 'ArrowRight') {
        showNextImage();
    } else if (e.key === 'ArrowLeft') {
        showPrevImage();
    }
}

/**
 * Renderiza a lista de documentos do projeto a partir de um campo customizado.
 * @param {object} dados - O objeto do projeto processado.
 */
function renderProjectDocuments(dados) {
    const listContainer = $('documentos-projeto-list');
    const sectionContainer = $('documentos-projeto-container');

    listContainer.innerHTML = ''; // Limpa a lista antes de adicionar novos itens

    const docUrlsString = dados.rawFields['[cap_doc_projeto]'];
    if (!docUrlsString) {
        sectionContainer.classList.add('oculto');
        return;
    }

    // Divide a string por nova linha para obter URLs individuais, limpando espaços e removendo linhas vazias
    const urls = docUrlsString.split('\n').map(url => url.trim()).filter(url => url);

    if (urls.length === 0) {
        sectionContainer.classList.add('oculto');
        return;
    }

    // Expressão regular para verificar se a URL termina com uma extensão de imagem comum.
    const isImageUrl = /\.(jpe?g|png|gif|webp|svg)$/i;

    // Filtra apenas as URLs de imagem para o lightbox
    lightboxState.imageUrls = urls.filter(url => isImageUrl.test(url));

    urls.forEach(url => {
        const fileName = extrairNomeRobusto(url);
        const isImage = isImageUrl.test(url);

        // O container principal agora é um 'div' para imagens, ou 'a' para outros arquivos
        const docItem = document.createElement(isImage ? 'div' : 'a');
        docItem.className = 'document-item';

        if (isImage) {
            docItem.title = `Visualizar ${fileName}`;
            const imageIndex = lightboxState.imageUrls.indexOf(url);
            docItem.addEventListener('click', () => openLightbox(imageIndex));
        } else {
            docItem.href = url;
            docItem.target = '_blank';
            docItem.rel = 'noopener noreferrer';
            docItem.title = `Baixar ${fileName}`;
        }

        const thumbnailDiv = document.createElement('div');
        thumbnailDiv.className = 'document-thumbnail';

        if (isImage) {
            const img = document.createElement('img');
            img.src = url;
            img.loading = 'lazy'; // Aplica o lazy loading para adiar o carregamento
            img.alt = `Miniatura de ${fileName}`;
            img.onerror = () => { thumbnailDiv.innerHTML = '<i class="fas fa-exclamation-triangle file-icon-error"></i>'; };
            thumbnailDiv.appendChild(img);
        } else {
            const icon = document.createElement('i');
            icon.className = 'fas fa-file-alt file-icon';
            thumbnailDiv.appendChild(icon);
        }
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'document-name';
        nameSpan.textContent = fileName;

        docItem.appendChild(thumbnailDiv);
        docItem.appendChild(nameSpan);
        listContainer.appendChild(docItem);
    });

    sectionContainer.classList.remove('oculto');
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

    // Eventos do Lightbox
    lightboxClose.addEventListener('click', closeLightbox);
    $('lightbox-overlay').addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', showPrevImage);
    lightboxNext.addEventListener('click', showNextImage);
    lightboxImageWrapper.addEventListener('click', toggleZoom); // Adiciona o listener de clique para zoom

    checkSessionAndInitialize();
});