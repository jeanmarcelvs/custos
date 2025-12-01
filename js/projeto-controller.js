import { buscarEProcessarProjeto } from "./model.js";
import { formatarMoeda } from "./utils.js";

/**
 * Atalho para document.getElementById.
 * @param {string} id O ID do elemento a ser encontrado.
 * @returns {HTMLElement | null}
 */
function $(id) {
    return document.getElementById(id);
}

/**
 * Exibe ou oculta a tela de carregamento (spinner).
 * @param {boolean} mostrar True para exibir, false para ocultar.
 */
function mostrarLoading(mostrar = true) {
    $("loading-overlay")?.classList.toggle("oculto", !mostrar);
}

/**
 * Exibe a tela inicial para busca de projeto.
 */
function exibirTelaDeBusca() {
    $("project-details-container")?.classList.add("oculto");
    $("project-search-container")?.classList.remove("oculto");

    $("project-search-form")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const id = $("project-id-input").value;
        if (id) {
            window.location.href = `projeto.html?projectId=${encodeURIComponent(id)}`;
        }
    });
}

/**
 * Preenche a interface com os dados do projeto carregado.
 * @param {object} projeto O objeto do projeto retornado pela API.
 */
function renderizarDetalhesProjeto(projeto) {
    $("project-details-container")?.classList.remove("oculto");
    $("project-search-container")?.classList.add("oculto");

    // Preenche o cabeçalho
    $("proj-title").innerHTML = `Projeto <span class="project-id-tag">#${projeto.id}</span>`;
    $("client-name-placeholder").textContent = projeto.nomeCliente ?? "Cliente não informado";
    $("info-data").textContent = new Date(projeto.dataCriacao).toLocaleDateString("pt-BR");

    // Cálculos
    const valorKit = Number(projeto.valorKit ?? 0);
    const valorProposta = Number(projeto.valorProposta ?? 0);
    const valorGDIS = valorProposta - valorKit;
    const totalCustos = Number(projeto.totais?.totalGeral ?? 0);
    const valorImposto = 0.12 * valorGDIS;
    const lucroSemImposto = valorGDIS - totalCustos;
    const lucroComImposto = lucroSemImposto - valorImposto;

    // Preenche KPIs
    $("val-total-projeto").textContent = formatarMoeda(valorProposta);
    $("val-kit").textContent = formatarMoeda(valorKit);
    $("val-gdis").textContent = formatarMoeda(valorGDIS);
    $("val-custos").textContent = formatarMoeda(totalCustos);
    $("val-lucro-sem-imposto").textContent = formatarMoeda(lucroSemImposto);
    $("val-imposto").textContent = formatarMoeda(valorImposto);
    $("val-lucro-com-imposto").textContent = formatarMoeda(lucroComImposto);

    // Aplica classes de estilo aos KPIs
    $("val-total-projeto").closest(".kpi").classList.add("kpi-neutral");
    $("val-kit").closest(".kpi").classList.add("kpi-neutral");
    $("val-lucro-sem-imposto").closest(".kpi").classList.add("kpi-lucro-bruto");
    $("val-custos").closest(".kpi").classList.add("kpi-cost");
    $("val-imposto").closest(".kpi").classList.add("kpi-cost");

    const kpiLucroCard = $("val-lucro-com-imposto").closest(".kpi");
    kpiLucroCard.classList.remove("kpi-profit-good", "kpi-profit-warning", "kpi-profit-bad");
    const margemDeLucro = valorGDIS > 0 ? (lucroComImposto / valorGDIS) * 100 : 0;

    if (margemDeLucro > 17) {
        kpiLucroCard.classList.add("kpi-profit-good");
    } else if (margemDeLucro >= 13) {
        kpiLucroCard.classList.add("kpi-profit-warning");
    } else {
        kpiLucroCard.classList.add("kpi-profit-bad");
    }

    // Preenche resumo de custos
    $("break-material").textContent = formatarMoeda(Number(projeto.totais?.material ?? 0));
    $("break-diarias").textContent = formatarMoeda(Number(projeto.totais?.diarias ?? 0));
    $("break-combustivel").textContent = formatarMoeda(Number(projeto.totais?.combustivel ?? 0));
    $("break-outras").textContent = formatarMoeda(Number(projeto.totais?.outras ?? 0));
}

/**
 * Configura os event listeners para os botões da página.
 * @param {string | null} projectId O ID do projeto atual.
 */
function configurarEventListeners(projectId) {
    $("btn-edit-page")?.addEventListener("click", () => {
        if (projectId) {
            window.location.href = `editar-projeto.html?projectId=${encodeURIComponent(projectId)}`;
        } else {
            alert("Nenhum projeto selecionado.");
        }
    });

    $("btn-logout")?.addEventListener("click", () => {
        localStorage.removeItem("authToken");
        window.location.href = "index.html";
    });

    $("btn-logout-search")?.addEventListener("click", () => {
        localStorage.removeItem("authToken");
        window.location.href = "index.html";
    });

    $("btn-refresh")?.addEventListener("click", () => location.reload());

    $("btn-search-page")?.addEventListener("click", () => {
        window.location.href = "projeto.html";
    });
}

/**
 * Função de inicialização da página.
 */
async function init() {
    if (!localStorage.getItem("authToken")) {
        window.location.href = "index.html";
        return;
    }

    const params = new URLSearchParams(location.search);
    const projectId = params.get("projectId");

    configurarEventListeners(projectId);

    if (!projectId) {
        exibirTelaDeBusca();
        return;
    }

    mostrarLoading(true);
    try {
        const projeto = await buscarEProcessarProjeto(projectId);
        if (projeto) {
            renderizarDetalhesProjeto(projeto);
        } else {
            alert("Erro ao carregar projeto. Veja o console.");
            // Redireciona para a busca se o projeto não for encontrado
            window.location.href = "projeto.html";
        }
    } catch (error) {
        $("client-name-placeholder").textContent = "Falha ao carregar dados.";
        console.error(error);
        alert("Erro ao carregar projeto. Veja o console.");
    } finally {
        mostrarLoading(false);
    }
}

// Inicia a aplicação
init();