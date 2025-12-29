import { buscarEProcessarProjeto, getMe } from './model.js';
import { formatarMoeda, formatarData } from './utils.js';

const $ = (id) => document.getElementById(id);

let projetoAtual = null;

/* =========================
   HELPERS DE CÁLCULO
========================= */
function calcularPercentual(valor, total) {
    if (!total || total === 0) return 0;
    return (valor / total) * 100;
}

function formatarPercentual(valor) {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

/* =========================
   RENDERIZAÇÃO
========================= */

function renderizarCabecalho(dados) {
    $('rep-id').textContent = `#${dados.id}`;
    $('rep-cliente').textContent = dados.cliente || '—';
    $('rep-data').textContent = formatarData(dados.meta?.createdAt);
    $('data-geracao').textContent = new Date().toLocaleString('pt-BR');
}

function renderizarResumo(dados) {
    const valorProposta = dados.valorProposta || 0;
    const valorKit = dados.valorKit || 0;
    const valorGdis = valorProposta - valorKit;
    const totalCustos = dados.totais?.totalGeral || 0;
    const lucroBruto = valorGdis - totalCustos;
    const imposto = dados.imposto?.valor || 0;
    const lucroLiquido = lucroBruto - imposto;

    $('sum-total-proj').textContent = formatarMoeda(valorProposta);
    $('sum-kit').textContent = formatarMoeda(valorKit);
    $('sum-gdis').textContent = formatarMoeda(valorGdis);
    $('sum-custos').textContent = formatarMoeda(totalCustos);
    $('sum-lucro').textContent = formatarMoeda(lucroBruto);
    $('sum-imposto').textContent = formatarMoeda(imposto);
    $('sum-lucro-liquido').textContent = formatarMoeda(lucroLiquido);

    // Helper para formatar as duas linhas de percentual
    const formatarInfos = (val) => {
        const pProj = calcularPercentual(val, valorProposta);
        const pGdis = calcularPercentual(val, valorGdis);
        return `${formatarPercentual(pProj)} do Projeto<br>${formatarPercentual(pGdis)} do GDIS`;
    };

    // Preenche os percentuais detalhados
    const pctGdisProj = calcularPercentual(valorGdis, valorProposta);
    $('info-gdis').textContent = `${formatarPercentual(pctGdisProj)} do Projeto`;

    $('info-custos').innerHTML = formatarInfos(totalCustos);
    $('info-lucro').innerHTML = formatarInfos(lucroBruto);
    $('info-imposto').innerHTML = formatarInfos(imposto);
    $('info-lucro-liquido').innerHTML = formatarInfos(lucroLiquido);

    // Aplicação de cores conforme a página principal (projeto.html / style.css)
    $('sum-total-proj').style.color = '#64748b';   // kpi-neutral
    $('sum-kit').style.color = '#64748b';          // kpi-neutral
    $('sum-gdis').style.color = '#000000';         // kpi-gdis
    $('sum-custos').style.color = 'var(--danger)'; // kpi-cost
    $('sum-lucro').style.color = '#1d4ed8';        // kpi-lucro-bruto (Azul)
    $('sum-imposto').style.color = 'var(--danger)';// kpi-cost

    // Lucro Líquido e Margem (Verde se positivo, Vermelho se negativo)
    const corResultado = lucroLiquido < 0 ? 'var(--danger)' : 'var(--success)';
    $('sum-lucro-liquido').style.color = corResultado;
}

function criarLinhaTabela(descricao, valor) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${descricao}</td>
        <td class="text-right">${formatarMoeda(valor)}</td>
    `;
    return tr;
}

function renderizarTabela(tabelaId, itens, baseProjeto, baseGdis, tituloTotal = 'Total') {
    const tabela = $(tabelaId);
    const tbody = tabela.querySelector('tbody');
    const tfoot = tabela.querySelector('tfoot');
    
    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    let somaCategoria = 0;

    if (!itens || itens.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="2" class="text-center text-muted">Nenhum item registrado.</td>`;
        tbody.appendChild(tr);
    } else {
        itens.forEach(item => {
            // O model.js retorna objetos com 'valor' ou 'custo' dependendo do parser.
            // Vamos garantir que pegamos o valor monetário correto.
            let valorItem = item.valor || item.custo || 0;
            
            // Descrição
            let descricao = item.descricao || item.nome || 'Item sem descrição';
            if (item.finalidade) descricao = `${item.finalidade} - ${descricao}`;

            tbody.appendChild(criarLinhaTabela(descricao, valorItem));
            somaCategoria += valorItem;
        });
    }

    // Aplica estilo visual de desabilitado se a categoria estiver zerada
    const section = tabela.closest('.report-section');
    if (section) {
        if (somaCategoria === 0) {
            section.classList.add('empty-section');
        } else {
            section.classList.remove('empty-section');
        }
    }

    // Rodapé da tabela
    const pctTotalProj = calcularPercentual(somaCategoria, baseProjeto);
    const pctTotalGdis = calcularPercentual(somaCategoria, baseGdis);

    tfoot.innerHTML = `
        <tr class="table-total-row">
            <td>${tituloTotal}</td>
            <td class="text-right">
                ${formatarMoeda(somaCategoria)}
                <div style="font-size: 0.8em; font-weight: normal; color: var(--muted); margin-top: 2px;">
                    ${formatarPercentual(pctTotalProj)} do Projeto<br>
                    ${formatarPercentual(pctTotalGdis)} do GDIS
                </div>
            </td>
        </tr>
    `;
}

async function carregarRelatorio() {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('projectId');

    if (!projectId) {
        alert('Projeto não especificado.');
        window.location.href = 'projeto.html';
        return;
    }

    try {
        // Verifica sessão
        const me = await getMe();
        if (!me?.sucesso) throw new Error('Sessão inválida');

        // Busca dados
        projetoAtual = await buscarEProcessarProjeto(projectId);
        
        // Bases de cálculo
        const baseProjeto = projetoAtual.valorProposta || 0;
        const baseGdis = (projetoAtual.valorProposta - projetoAtual.valorKit) || 0;

        // Renderiza
        renderizarCabecalho(projetoAtual);
        renderizarResumo(projetoAtual);

        // Renderiza Tabelas
        renderizarTabela('table-material', projetoAtual.itens.material, baseProjeto, baseGdis);
        renderizarTabela('table-diarias', projetoAtual.itens.diarias, baseProjeto, baseGdis);
        
        // Combustível precisa de tratamento especial pois é um array misto no model
        // O model.js exportado no contexto retorna 'combustivel' como array de objetos.
        const itensCombustivel = (projetoAtual.itens.combustivel || []).map(c => {
            // Recalcula custo se não vier pronto (garantia)
            let custo = c.custo || c.valor || 0;
            if (!custo) {
                if (c.finalidade === 'Venda') custo = (c.distancia * 2 / 10.6) * c.valorLitro;
                else if (c.finalidade === 'Instalação') custo = c.litros * c.valorLitro;
            }
            return { ...c, valor: custo };
        });
        renderizarTabela('table-combustivel', itensCombustivel, baseProjeto, baseGdis);

        // Outras categorias de custo
        renderizarTabela('table-alimentacao', projetoAtual.itens.alimentacao, baseProjeto, baseGdis);
        renderizarTabela('table-ferramenta', projetoAtual.itens.ferramenta, baseProjeto, baseGdis);
        renderizarTabela('table-desp-projeto', projetoAtual.itens.despProjeto, baseProjeto, baseGdis);
        renderizarTabela('table-desp-fixas', projetoAtual.itens.despFixasGerais, baseProjeto, baseGdis);
        renderizarTabela('table-indicacao', projetoAtual.itens.indicacao, baseProjeto, baseGdis);

        // Exibe conteúdo
        $('loading-message').classList.add('oculto');
        $('report-content').classList.remove('oculto');

    } catch (err) {
        console.error(err);
        alert('Erro ao carregar relatório: ' + err.message);
        window.location.href = 'index.html';
    }
}

/* =========================
   INIT
========================= */
document.addEventListener('DOMContentLoaded', () => {
    $('btn-voltar')?.addEventListener('click', () => {
        const params = new URLSearchParams(window.location.search);
        const projectId = params.get('projectId');
        if (projectId) {
            window.location.href = `projeto.html?projectId=${projectId}`;
        } else {
            history.back();
        }
    });

    $('btn-imprimir')?.addEventListener('click', () => {
        window.print();
    });

    $('btn-simplificado')?.addEventListener('click', () => {
        const params = new URLSearchParams(window.location.search);
        const projectId = params.get('projectId');
        if (projectId) {
            window.location.href = `relatorio-simplificado.html?projectId=${projectId}`;
        }
    });

    carregarRelatorio();
});