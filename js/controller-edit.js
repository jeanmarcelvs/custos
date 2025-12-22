import { formatarMoeda as formatCurrency, converterStringParaNumero as parseCurrency, formatarNumeroParaBR, parseLinhaParaItem, formatarInputMonetario, arredondarParaDuasCasas } from './utils.js';
import { buscarEProcessarProjeto, atualizarCampoUnico, KEYS as API_KEYS, getMe } from './model.js';

/**
 * Atalho para document.getElementById.
 * @param {string} id O ID do elemento.
 * @returns {HTMLElement | null}
 */
const $ = (id) => document.getElementById(id);

/** Mapeamento de chaves locais para as categorias de custo. */
const KEYS = {
  DESPESAS_PROJETO: 'despProjeto',
  DESPESAS_FIXAS: 'despFixasGerais',
  MATERIAL: 'material',
  FERRAMENTA: 'ferramenta',
  DIARIAS: 'diarias',
  ALIMENTACAO: 'alimentacao',
  INDICACAO: 'indicacao',
  COMBUSTIVEL: 'combustivel',
};

/** Consumo fixo de combustível em km/L. */
const CONSUMO_FIXO = 10.6; // km/L

// --- Estado da Aplicação ---
let projectData = {};
let projectId = null;
let currentUserUsername = null;

/**
 * Exibe ou oculta a tela de carregamento.
 * @param {boolean} [mostrar=true] - True para exibir, false para ocultar.
 */
function mostrarLoading(sim = true) {
  $('loading-overlay')?.classList.toggle('oculto', !sim);
}

/**
 * Bloqueia ou desbloqueia a interface para evitar ações conflitantes durante a edição.
 * @param {boolean} [lock=true] - True para bloquear, false para desbloquear.
 */
function lockInterface(lock = true) {
    document.body.classList.toggle('is-locked-for-editing', lock); // Mantém para desabilitar abas e botão voltar.

    // REVISÃO PROFUNDA: Lógica de bloqueio movida para o JS para controle explícito.
    const elementsToToggle = document.querySelectorAll('.btn-action, .btn-add-item');
    
    if (lock) {
        // Ao bloquear, desabilita TODOS os botões de ação.
        // Os botões da linha de edição serão reabilitados explicitamente depois.
        elementsToToggle.forEach(el => el.classList.add('is-disabled'));
    } else {
        // Ao desbloquear, simplesmente remove a classe de todos.
        elementsToToggle.forEach(el => el.classList.remove('is-disabled'));
    }
}

function enableElement(element, enable = true) {
    if (!element) return;
    element.classList.toggle('is-disabled', !enable);
}

/**
 * Cria dinamicamente a estrutura de abas e seções do editor.
 * @returns {boolean} True se a UI foi inicializada com sucesso, false caso contrário.
 */
function initializeEditorUI() {
  const editorSectionsContainer = $('editor-sections');
  if (!editorSectionsContainer) {
    console.error("ERRO CRÍTICO: O container 'editor-sections' não foi encontrado no DOM.");
    return false;
  }

    const sections = [
        { title: 'Projeto', key: KEYS.DESPESAS_PROJETO, listId: 'lista-despesas-projeto' },
        { title: 'Fixa/Admin', key: KEYS.DESPESAS_FIXAS, listId: 'lista-despFixasGerais' },
        { title: 'Material Inst.', key: KEYS.MATERIAL, listId: 'lista-material' },
        { title: 'Diárias/M.O.', key: KEYS.DIARIAS, listId: 'lista-diarias' },
        { title: 'Aluguel', key: KEYS.FERRAMENTA, listId: 'lista-ferramenta' },
        { title: 'Indicação', key: KEYS.INDICACAO, listId: 'lista-indicacao' },
    ];

    const tabsNavHTML = `
    <div class="tabs-nav">
      ${sections.map((s, index) => `<button class="tab-link ${index === 0 ? 'active' : ''}" data-tab="sec-${s.listId.replace('lista-', '')}">${s.title}</button>`).join('')}
      <button class="tab-link" data-tab="sec-combustivel">Combustível</button>
      <button class="tab-link" data-tab="sec-alimentacao">Alimentação</button>
    </div>
  `;

    const tabsContentHTML = `
    <div class="tabs-content">
      ${sections.map(s => createSectionHTML(s.key, s.listId)).join('')}
      <div class="editor-section" id="sec-combustivel" data-key="combustivel">
        <div class="section-summary">
          <div class="group-total"><span>Total</span><strong id="total-combustivel">R$ 0,00</strong></div>
          <div class="attachment-list" id="attachments-combustivel"></div>
        </div>
      </div>
      ${createSectionHTML(KEYS.ALIMENTACAO, 'lista-alimentacao')}
    </div>
  `;

    editorSectionsContainer.innerHTML = tabsNavHTML + tabsContentHTML;
  return true;
}

/**
 * Gera o HTML para uma seção de editor padrão.
 * @param {string} key - A chave da seção (ex: 'material').
 * @param {string} listId - O ID do container da lista de itens.
 * @returns {string} O HTML da seção.
 */
function createSectionHTML(key, listId) {
  return `
    <div class="editor-section" id="sec-${listId.replace('lista-', '')}" data-key="${key}" data-container="${listId}">
      <div id="${listId}"></div>
      <div class="controls">
        <button class="btn-action btn-add-item" title="Adicionar item"><i class="fas fa-plus"></i></button>
      </div>
      <div class="section-summary">
        <div class="group-total"><span>Total</span><strong id="total-${key}">R$ 0,00</strong></div>
        <div class="attachment-list" id="attachments-${key}"></div>
      </div>
    </div>
  `;
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
    const nomeComPrefixo = urlDecodificada.split('/').pop();

    // 3. Define o delimitador que separa o prefixo do nome real do arquivo.
    const delimitador = '#-';

    // 4. Divide a string no delimitador.
    const partes = nomeComPrefixo.split(delimitador);

    // 5. Se o delimitador foi encontrado, retorna a segunda parte (o nome real).
    return (partes.length > 1) ? partes[1] : nomeComPrefixo;
}

/**
 * Renderiza as listas de comprovantes para todas as seções.
 */
function renderizarComprovantes() {
    const attachmentMap = {
        'despProjeto': API_KEYS.COMPROVANTES_DESP_PROJETO,
        'despFixasGerais': API_KEYS.COMPROVANTES_DESP_FIXAS,
        'material': API_KEYS.COMPROVANTES_MATERIAL,
        'ferramenta': API_KEYS.COMPROVANTES_ALUGUEIS,
        'diarias': API_KEYS.COMPROVANTES_DIARIAS,
        'alimentacao': API_KEYS.COMPROVANTES_ALIMENTACAO,
        'indicacao': API_KEYS.COMPROVANTE_INDICACAO,
        'combustivel': API_KEYS.COMPROVANTES_COMBUSTIVEL,
    };

    for (const localKey in attachmentMap) {
        const apiKey = attachmentMap[localKey];
        const container = $(`attachments-${localKey}`);

        if (container && projectData.rawFields && projectData.rawFields[apiKey]) {
            const valorComoString = String(projectData.rawFields[apiKey] || '');
            const urls = valorComoString.split('\n').filter(url => url.trim() !== '');
            if (urls.length > 0) {
                container.innerHTML = '<h4>Comprovantes</h4>';
                const list = document.createElement('ul');
                urls.forEach(url => {
                    const link = document.createElement('a');
                    link.href = url;
                    // Usa a função para extrair o nome amigável do arquivo.
                    link.textContent = extrairNomeRobusto(url);
                    link.target = '_blank';
                    const listItem = document.createElement('li');
                    listItem.appendChild(link);
                    list.appendChild(listItem);
                });
                container.appendChild(list);
            }
        }
    }
}

/**
 * Configura os event listeners principais da página do editor.
 */
function setupEventListeners() {
  $('btn-voltar').addEventListener('click', () => {
    window.location.href = `projeto.html?projectId=${projectId}`;
  });

  const tabLinks = document.querySelectorAll('.tab-link');
  const tabPanes = document.querySelectorAll('.editor-section');

  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      const tabId = link.dataset.tab;

      tabLinks.forEach(l => l.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      link.classList.add('active');
      const activePane = document.getElementById(tabId);
      if (activePane) activePane.classList.add('active');

    });
  });

  document.querySelectorAll('.btn-add-item').forEach(button => {
    button.addEventListener('click', (e) => {
      // CORREÇÃO: Encontra a chave da seção a partir do elemento pai do accordion.
      const key = e.currentTarget.closest('.editor-section').dataset.key;
      adicionarItem(key);
    });
  });
}

/**
 * Carrega os dados em todas as seções do editor.
 */
function loadAllSections() {
  // Recria a mesma estrutura de seções para garantir consistência
  const sections = [
    { key: KEYS.DESPESAS_PROJETO, listId: 'lista-despesas-projeto' },
    { key: KEYS.DESPESAS_FIXAS, listId: 'lista-despFixasGerais' },
    { key: KEYS.INDICACAO, listId: 'lista-indicacao' },
    { key: KEYS.MATERIAL, listId: 'lista-material' },
    { key: KEYS.DIARIAS, listId: 'lista-diarias' },
    { key: KEYS.FERRAMENTA, listId: 'lista-ferramenta' },
    { key: KEYS.ALIMENTACAO, listId: 'lista-alimentacao' }
  ];

  sections.forEach(section => {
    const listaContainer = $(section.listId);
    if (listaContainer) {
      popularLista(section.key, listaContainer);
    }
  });

  renderCombustivelSection();
  renderizarComprovantes();
}

/**
 * Recarrega os dados da API e atualiza a UI, preservando a aba ativa.
 */
async function refreshDataAndUI() {
    // 1. Salva a aba ativa
    const activeTabLink = document.querySelector('.tab-link.active');
    const activeTabId = activeTabLink ? activeTabLink.dataset.tab : null;

    mostrarLoading(true);
    try {
        // 2. Busca os dados mais recentes
        projectData = await buscarEProcessarProjeto(projectId);
        if (!projectData) throw new Error("Falha ao recarregar dados do projeto.");

        // 3. Re-renderiza todas as seções
        loadAllSections();

        // 4. Atualiza todos os totais
        Object.values(KEYS).forEach(key => atualizarTotal(key));
        atualizarTotalCombustivel();

    } catch (error) {
        console.error("Erro ao atualizar dados e UI:", error);
        alert("Ocorreu um erro ao atualizar os dados. Por favor, recarregue a página.");
    } finally {
        // 5. Restaura a aba que estava ativa
        if (activeTabId && document.getElementById(activeTabId)) {
            document.querySelector(`.tab-link[data-tab="${activeTabId}"]`)?.classList.add('active');
            document.getElementById(activeTabId).classList.add('active');
        }
        mostrarLoading(false);
    }
}

/**
 * Popula uma lista de itens em uma seção específica.
 * @param {string} key - A chave da seção.
 * @param {HTMLElement} listaContainer - O elemento container da lista.
 */
function popularLista(key, listaContainer) {
  listaContainer.innerHTML = '';
  const itens = projectData.itens[key] || [];
  
  itens.forEach(item => {
    const rowElement = criarLinhaItemExistente(item, key);
    listaContainer.appendChild(rowElement);
  });

  verificarEstadoVazio(key);
}

/**
 * Adiciona uma nova linha de item editável a uma seção.
 * @param {string} key - A chave da seção.
 */
function adicionarItem(key) {
  const section = document.querySelector(`.editor-section[data-key="${key}"]`);
  const listaContainer = section ? $(section.dataset.container) : null;

  if (!listaContainer) return;

  // Remove a mensagem de estado vazio, se existir
  listaContainer.querySelector('.empty-state-message')?.remove();

  const newItem = { id: Date.now(), descricao: '', valor: 0 };
  if (key === KEYS.INDICACAO) {
    newItem.nome = '';
    newItem.telefone = '';
    delete newItem.descricao;
  }

  const newRow = criarLinhaItemNovo(newItem, key);
  listaContainer.appendChild(newRow);
  if (key === KEYS.INDICACAO) {
    modoEdicaoIndicador(newItem, newRow, { isNew: true });
  } else {
    modoEdicao(newItem, newRow, { isNew: true });
  }
}

/**
 * Cria o elemento HTML para uma linha de item existente (modo de visualização).
 * @param {object} item - O objeto do item.
 * @param {string} key - A chave da seção.
 * @returns {HTMLDivElement} O elemento da linha.
 */
function criarLinhaItemExistente(item, key) {
    console.log(`[criarLinhaItemExistente] Renderizando item (key: ${key}):`, { id: item.id, date: item.date });
    const row = document.createElement('div');
    row.className = 'item-row';
    row.dataset.itemId = item.id;

    const isOwner = !item.user || item.user === currentUserUsername;
    if (!isOwner) {
        row.classList.add('not-owned');
        row.title = `Item criado por: ${item.user}. Você não pode editá-lo.`;
    }

    if (key === KEYS.INDICACAO) {
        row.innerHTML = `
            <div class="item-details" style="flex: 1;">
                <span>${item.nome || 'Sem nome'}</span><br>
                <small class="meta-info">${item.telefone || ''}</small>
                <small class="meta-info owner-info">
                    <i class="fas fa-user"></i> ${item.user || '?'} | <i class="fas fa-calendar-alt"></i> ${item.date ? new Date(item.date.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A'}
                </small>
            </div>
            <div class="item-value">${formatCurrency(item.valor)}</div>
        `;
    } else {
        row.innerHTML = `
            <div class="item-details">
                <span>${item.descricao || 'Sem descrição'}</span><br>
                <small class="meta-info owner-info">
                    <i class="fas fa-user"></i> ${item.user || '?'} | <i class="fas fa-calendar-alt"></i> ${item.date ? new Date(item.date.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A'}
                </small>
            </div>
            <div class="item-value">${formatCurrency(item.valor)}</div>
        `;
    }
    
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    actions.innerHTML = `
        <button class="btn-action btn-edit" title="Editar" ${!isOwner ? 'disabled' : ''}><i class="fas fa-edit"></i></button>
        <button class="btn-action btn-delete" title="Remover" ${!isOwner ? 'disabled' : ''}><i class="fas fa-trash-alt"></i></button>
    `;
    row.appendChild(actions);
    
    if (isOwner) {
        row.querySelector('.btn-edit').addEventListener('click', () => {
            if (key === KEYS.INDICACAO) modoEdicaoIndicador(item, row);
            else modoEdicao(item, row);
        });
    }

    const btnDelete = row.querySelector('.btn-delete');
    btnDelete.addEventListener('click', (e) => {
        e.stopPropagation(); // Impede que o clique se propague e cancele a confirmação imediatamente

        if (btnDelete.classList.contains('confirm-delete')) {
            // Segundo clique: executa a ação
            removerItem(key, item.id);
        } else {
            // Primeiro clique: arma o botão para confirmação
            const originalHTML = btnDelete.innerHTML;
            btnDelete.classList.add('confirm-delete');
            btnDelete.innerHTML = '<i class="fas fa-check"></i> Confirmar?';
            
            const revert = () => {
                btnDelete.classList.remove('confirm-delete');
                btnDelete.innerHTML = originalHTML;
                document.removeEventListener('click', revert);
            };

            setTimeout(revert, 3000); // Reverte após 3 segundos
            document.addEventListener('click', revert, { once: true }); // Reverte ao clicar fora
        }
    });

    return row;
}

/**
 * Cria um container de linha de item para o modo de edição.
 * @param {object} item - O objeto do item.
 * @param {string} key - A chave da seção.
 * @returns {HTMLDivElement} O elemento da linha.
 */
function criarLinhaItemNovo(item, key) {
    const row = document.createElement('div');
    row.className = 'item-row editing';
    row.dataset.itemId = item.id;
    return row;
}
/**
 * Habilita os botões de ação dentro de um elemento específico.
 * @param {HTMLElement} parentElement O elemento pai (ex: a linha de edição).
 */
function enableActionsWithin(parentElement) {
    parentElement.querySelectorAll('.btn-action').forEach(btn => enableElement(btn, true));
}

/**
 * Limpa todos os botões que estão em estado de confirmação.
 */
function clearAllConfirmations() {
    const confirmedButton = document.querySelector('[data-confirmed="true"]');
    if (confirmedButton && confirmedButton._revert) {
        confirmedButton._revert();
    }
}

/**
 * Valida um conjunto de campos de input.
 * @param {Array<object>} validations - Array de objetos de validação.
 * @returns {boolean} True se todos os campos forem válidos.
 */
function validarCampos(validations) {
    let allValid = true;
    for (const { element, type, value } of validations) {
        let isValid = false;
        switch (type) {
            case 'description':
                isValid = /[A-Za-zÀ-ÿ]{3,}/.test(value);
                break;
            case 'numeric': // Validação numérica
                isValid = value > 0;
                break;
            case 'money':
                isValid = value > 0;
                break;
            default:
                isValid = true;
        }

        if (isValid) {
            element.classList.remove('input-invalid');
        } else {
            element.classList.add('input-invalid');
            allValid = false;
        }
    }
    return allValid;
}

/**
 * Configura a validação em tempo real para um conjunto de inputs.
 * @param {Array<object>} inputs - Array de objetos de validação.
 * @param {HTMLButtonElement} saveButton - O botão de salvar a ser habilitado/desabilitado.
 */
function setupValidation(inputs, saveButton) {
    inputs.forEach(input => {
        input.element.addEventListener('input', () => saveButton.disabled = !validarCampos(inputs));
    });
}

/**
 * Transforma um botão em um botão de confirmação temporário.
 * @param {HTMLElement} element O botão a ser modificado.
 * @param {string} text O texto de confirmação.
 */
function confirmAction(element, text = 'Confirmar?') {
    const originalHTML = element.innerHTML;
    const originalClass = element.className;

    const selectivelyDisabled = [];
    // REVISÃO PROFUNDA: Bloqueio seletivo para confirmação.
    // Desabilita todos os botões, exceto o de confirmação e os de edição (escape).
    document.querySelectorAll('.btn-action, .btn-add-item').forEach(btn => {
        if (btn !== element && !btn.classList.contains('btn-edit')) {
            enableElement(btn, false);
            selectivelyDisabled.push(btn);
        }
    });

    element.dataset.confirmed = 'true';
    element.innerHTML = `<i class="fas fa-check"></i> ${text}`;

    // CORREÇÃO: Adiciona a classe de confirmação apropriada para aplicar o estilo de destaque do CSS.
    // Isso restaura o fundo vermelho/verde e a largura do botão.
    if (originalClass.includes('success')) {
        element.classList.add('confirm-save');
    } else if (originalClass.includes('danger') || element.classList.contains('btn-delete')) { // Adicionado .btn-delete para o caso do combustível
        element.classList.add('confirm-delete');
    }

    // Armazena a função de reversão no próprio elemento para acesso externo.
    element._revert = () => {
        if (element.dataset.confirmed) {
            delete element.dataset.confirmed;
            element.innerHTML = originalHTML;
            element.className = originalClass;
            // REVISÃO PROFUNDA: Restaura o estado de bloqueio correto.
            // Se ainda estivermos em modo de edição (a linha tem a classe 'editing'),
            // reabilita apenas os botões da linha atual. Caso contrário, libera tudo.
            const parentRow = element.closest('.editing');
            if (parentRow) enableActionsWithin(parentRow);

            element.classList.remove('confirm-save', 'confirm-delete'); // Limpa as classes de confirmação
            document.removeEventListener('click', element._revert);
            delete element._revert; // Limpa a referência
        }
    };

    setTimeout(element._revert, 3000);
    document.addEventListener('click', element._revert);
}

function modoEdicao(item, rowElement, opts = {}) {
    // CORREÇÃO: Garante que qualquer estado de confirmação anterior seja limpo
    // antes de entrar no modo de edição, evitando que os novos botões sejam desabilitados.
    clearAllConfirmations();
    lockInterface(true); // Bloqueia a UI novamente, mas agora para o modo de edição.
    const key = rowElement.closest('.editor-section').dataset.key;
    rowElement.classList.add('editing');

    const createInput = (type, value, placeholder, style) => {
        const input = document.createElement('input');
        Object.assign(input, { type, value, placeholder, className: 'item-input', style });
        return input;
    };

    const inpDesc = document.createElement('input');
    inpDesc.type = 'text';
    inpDesc.className = 'item-input';
    inpDesc.value = item.descricao;
    inpDesc.placeholder = 'Descrição';
    inpDesc.style.flex = '1';

    const inpValor = document.createElement('input');
    inpValor.type = 'text';
    inpValor.className = 'item-input';
    inpValor.value = formatCurrency(item.valor);
    inpValor.placeholder = 'R$ 0,00';
    inpValor.style.maxWidth = '120px';

    inpValor.addEventListener('input', () => {
        formatarInputMonetario(inpValor);
        atualizarTotalDinamico(key);
    });

    const btnSave = document.createElement('button');
    btnSave.className = 'btn-action btn-save success';
    btnSave.innerHTML = '<i class="fas fa-save"></i>';

    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn-action btn-cancel-edit danger';
    btnCancel.innerHTML = '<i class="fas fa-times"></i>';

    btnSave.disabled = true; // Desabilitado por padrão

    const validations = [
        { element: inpDesc, type: 'description', get value() { return inpDesc.value; } },
        { element: inpValor, type: 'money', get value() { return parseCurrency(inpValor.value); } }
    ];

    setupValidation(validations, btnSave);
    setTimeout(() => btnSave.disabled = !validarCampos(validations), 0); // Validação inicial

    // PADRONIZAÇÃO: Adiciona a confirmação ao botão Salvar.
    btnSave.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btnSave.dataset.confirmed) {
            const valorArredondado = arredondarParaDuasCasas(parseCurrency(inpValor.value));
            salvarItem(key, item.id, { descricao: inpDesc.value, valor: valorArredondado }, rowElement);
        } else {
            confirmAction(btnSave, 'Salvar?');
        }
    });

    btnCancel.addEventListener('click', () => {
        if (opts.isNew) rowElement.remove();
        else cancelarEdicao(item, rowElement, key);
        lockInterface(false);
        verificarEstadoVazio(key);
        atualizarTotalDinamico(key);
    });

    rowElement.innerHTML = '';
    rowElement.append(inpDesc, inpValor, btnSave, btnCancel);
    
    // REVISÃO PROFUNDA: Reabilita explicitamente os botões recém-criados.
    enableActionsWithin(rowElement);
    inpDesc.focus();
}

/**
 * Atualiza o total de uma seção em tempo real durante a edição, lendo os valores do DOM.
 * @param {string} key - A chave da seção.
 */
function atualizarTotalDinamico(key) {
    const section = document.querySelector(`.editor-section[data-key="${key}"]`);
    if (!section) return;

    const listaContainer = $(section.dataset.container);
    if (!listaContainer) return;

    let total = 0;
    const rows = listaContainer.querySelectorAll('.item-row');

    rows.forEach(row => {
        const inputValor = row.querySelector('input.item-input[placeholder="R$ 0,00"]');
        const displayValor = row.querySelector('.item-value');
        total += parseCurrency(inputValor ? inputValor.value : (displayValor ? displayValor.textContent : '0'));
    });

    $(`total-${key}`).textContent = formatCurrency(total);
}

/**
 * Entra no modo de edição para um item da seção 'Indicação'.
 * @param {object} item - O objeto do item.
 * @param {HTMLDivElement} rowElement - O elemento da linha a ser editado.
 * @param {object} [opts={}] - Opções, como {isNew: boolean}.
 */
function modoEdicaoIndicador(item, rowElement, opts = {}) {
    clearAllConfirmations(); // Limpa o estado de confirmação (desbloqueia a UI)
    lockInterface(true); // Bloqueia a UI novamente, mas agora para o modo de edição.
    const key = KEYS.INDICACAO;
    rowElement.classList.add('editing');

    const inpNome = document.createElement('input');
    inpNome.type = 'text';
    inpNome.className = 'item-input';
    inpNome.value = item.nome || '';
    inpNome.placeholder = 'Nome do indicador';
    inpNome.style.flex = '1';

    const inpTelefone = document.createElement('input');
    inpTelefone.type = 'text';
    inpTelefone.className = 'item-input';
    inpTelefone.value = item.telefone || '';
    inpTelefone.placeholder = 'Telefone';
    inpTelefone.style.minWidth = '120px';
    inpTelefone.style.maxWidth = '150px';

    const inpValor = document.createElement('input');
    inpValor.type = 'text';
    inpValor.className = 'item-input';
    inpValor.value = formatCurrency(item.valor);
    inpValor.placeholder = 'R$ 0,00';
    inpValor.style.minWidth = '100px';
    inpValor.style.maxWidth = '150px';

    inpValor.addEventListener('input', () => {
        formatarInputMonetario(inpValor);
        atualizarTotalDinamico(key);
    });

    const btnSave = document.createElement('button');
    btnSave.className = 'btn-action btn-save success';
    btnSave.innerHTML = '<i class="fas fa-save"></i>';

    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn-action btn-cancel-edit danger';
    btnCancel.innerHTML = '<i class="fas fa-times"></i>';

    btnSave.disabled = true;

    const validations = [
        { element: inpNome, type: 'description', get value() { return inpNome.value; } },
        { element: inpTelefone, type: 'numeric', get value() { return inpTelefone.value.replace(/\D/g,''); } },
        { element: inpValor, type: 'money', get value() { return parseCurrency(inpValor.value); } }
    ];

    setupValidation(validations, btnSave);
    setTimeout(() => btnSave.disabled = !validarCampos(validations), 0);

    // PADRONIZAÇÃO: Adiciona a confirmação ao botão Salvar.
    btnSave.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btnSave.dataset.confirmed) {
            const valorArredondado = arredondarParaDuasCasas(parseCurrency(inpValor.value));
            salvarItem(key, item.id, { nome: inpNome.value, telefone: inpTelefone.value, valor: valorArredondado }, rowElement);
        } else {
            confirmAction(btnSave, 'Salvar?');
        }
    });

    btnCancel.addEventListener('click', () => {
        if (opts.isNew) rowElement.remove();
        else cancelarEdicao(item, rowElement, key);
        lockInterface(false);
        verificarEstadoVazio(key);
        atualizarTotalDinamico(key);
    });

    rowElement.innerHTML = '';
    rowElement.append(inpNome, inpTelefone, inpValor, btnSave, btnCancel);

    // REVISÃO PROFUNDA: Reabilita explicitamente os botões recém-criados.
    enableActionsWithin(rowElement);
    inpNome.focus();
}

/**
 * Salva as alterações de um item (novo ou existente) na API.
 * @param {string} key - A chave da seção.
 * @param {number} itemId - O ID do item.
 * @param {object} data - Os novos dados do item.
 * @param {HTMLDivElement} rowElement - O elemento da linha.
 */
async function salvarItem(key, itemId, data, rowElement) {
    // Validação final antes de enviar para a API
    const valor = data.valor;
    const descricao = data.descricao || data.nome; // para 'indicacao'
    if (!descricao || String(descricao).trim().length < 3 || !valor || valor <= 0) {
        alert('Dados inválidos. Verifique a descrição (mínimo 3 caracteres) e o valor (deve ser maior que zero).');
        // Poderíamos também destacar os campos inválidos aqui se a linha de edição ainda estivesse visível.
        return;
    }

    mostrarLoading(true);

    if (!projectData.itens[key]) {
        projectData.itens[key] = [];
    }

    let item = projectData.itens[key].find(i => i.id === itemId);
    if (item) {
        Object.assign(item, data);
    } else {
        item = { id: itemId, ...data };
        projectData.itens[key].push(item);
    }

    const localKeyName = Object.keys(KEYS).find(k => KEYS[k] === key);
    if (!localKeyName) return;

    try {
        // CORREÇÃO: Gera a data local para evitar problemas de fuso horário.
        const today = new Date().toLocaleDateString('sv-SE'); // Formato YYYY-MM-DD
        console.log(`[salvarItem] Data local gerada (today): ${today}`);

        const itensParaApi = projectData.itens[key].map(i => {
            // Garante que a data seja sempre a data local correta,
            // corrigindo itens antigos que possam ter datas nulas ou em UTC.
            const dataFinal = i.id === itemId ? today : (i.date ? new Date(i.date.split('T')[0] + 'T12:00:00').toLocaleDateString('sv-SE') : today);
            
            if (key === KEYS.INDICACAO) {
                return { id: i.id, user: i.user || currentUserUsername, date: dataFinal, nome: i.nome || '', telefone: i.telefone || '', valor: i.valor };
            }
            return { id: i.id, user: i.user || currentUserUsername, date: dataFinal, descricao: i.descricao || '', valor: i.valor };
        });
        const payloadJson = JSON.stringify(itensParaApi);

        const fieldKey = API_KEYS[localKeyName.toUpperCase()];
        await atualizarCampoUnico(projectId, fieldKey, payloadJson, projectData.fieldIds);

        const somaBruta = projectData.itens[key].reduce((acc, item) => acc + (item.valor || 0), 0);
        const total = arredondarParaDuasCasas(somaBruta);
        const totalFieldKey = API_KEYS[`TOTAL_${localKeyName.toUpperCase()}`];
        if (totalFieldKey) {
            await atualizarCampoUnico(projectId, totalFieldKey, total.toString(), projectData.fieldIds);
        }

        // On success, refresh the UI to show the new state from the server.
        await refreshDataAndUI();
        lockInterface(false); // Desbloqueia a UI após o sucesso

    } catch (error) {
        console.error("Falha ao salvar item:", error);
        alert("Ocorreu um erro ao salvar. Tente novamente.");
        // On failure, just hide the loading indicator. The user's edit remains on screen.
        lockInterface(false); // Também desbloqueia em caso de falha
        mostrarLoading(false);
    }
}

/**
 * Cancela o modo de edição de um item, revertendo para o modo de visualização.
 * @param {object} item - O objeto original do item.
 * @param {HTMLDivElement} rowElement - O elemento da linha.
 * @param {string} key - A chave da seção.
 */
function cancelarEdicao(item, rowElement, key) {
    rowElement.classList.remove('editing');
    const originalRow = criarLinhaItemExistente(item, key);
    rowElement.replaceWith(originalRow);
}

/**
 * Remove um item da lista e atualiza a API.
 * @param {string} key - A chave da seção.
 * @param {number} itemId - O ID do item a ser removido.
 */
async function removerItem(key, itemId) {
    if (!projectData.itens[key]) return;

    projectData.itens[key] = projectData.itens[key].filter(i => i.id !== itemId);

    // CORREÇÃO: Gera a data local para evitar problemas de fuso horário.
    const today = new Date().toLocaleDateString('sv-SE'); // Formato YYYY-MM-DD
    console.log(`[removerItem] Data local gerada (today): ${today}`);

    const itensParaApi = projectData.itens[key].map(i => {
        const dataCorreta = i.date ? new Date(i.date.split('T')[0] + 'T12:00:00').toLocaleDateString('sv-SE') : today; // Mantém data existente se houver

        if (key === KEYS.INDICACAO) {
            return { id: i.id, user: i.user || currentUserUsername, date: dataCorreta, nome: i.nome || '', telefone: i.telefone || '', valor: i.valor };
        } else {
            return { id: i.id, user: i.user || currentUserUsername, date: dataCorreta, descricao: i.descricao || '', valor: i.valor };
        }
    });
    const payloadJson = JSON.stringify(itensParaApi);

    const localKeyName = Object.keys(KEYS).find(k => KEYS[k] === key);
    if (!localKeyName) return;

    const fieldKey = API_KEYS[localKeyName.toUpperCase()];

    try {
        mostrarLoading(true);
        await atualizarCampoUnico(projectId, fieldKey, payloadJson, projectData.fieldIds);

        const somaBruta = projectData.itens[key].reduce((acc, item) => acc + (item.valor || 0), 0);
        const total = arredondarParaDuasCasas(somaBruta);
        const totalFieldKey = API_KEYS[`TOTAL_${localKeyName.toUpperCase()}`];
        if (totalFieldKey) {
            await atualizarCampoUnico(projectId, totalFieldKey, total.toString(), projectData.fieldIds);
        }
    } catch (error) {
        console.error("Falha ao remover item:", error);
        alert("Ocorreu um erro ao remover o item. Tente novamente.");
    } finally {
        await refreshDataAndUI();
        // A UI é desbloqueada implicitamente pelo refresh que remove a classe 'editing'
    }
}

/**
 * Verifica se uma lista de itens está vazia e exibe uma mensagem apropriada.
 * @param {string} key - A chave da seção.
 */
function verificarEstadoVazio(key) {
    const section = document.querySelector(`.editor-section[data-key="${key}"]`);
    const listaContainer = $(section.dataset.container);
    const emptyState = listaContainer.querySelector('.empty-state-message');

    if (listaContainer.children.length === 0 || (listaContainer.children.length === 1 && emptyState)) {
        if (!emptyState) {
            listaContainer.innerHTML = '<div class="empty-state-message">Nenhum item cadastrado.</div>';
        }
    } else if (listaContainer.children.length > 1 && emptyState) {
        emptyState.remove();
    }
}

/**
 * Atualiza o valor total exibido para uma seção.
 * @param {string} key - A chave da seção.
 */
function atualizarTotal(key) {
  const itens = projectData.itens[key] || [];
  const total = itens.reduce((acc, item) => acc + (item.valor || 0), 0);
  const totalElement = $(`total-${key}`);
  if (totalElement) {
    totalElement.textContent = formatCurrency(total);
  }
}

/**
 * Renderiza a seção de combustível, separando os itens de 'Venda' e 'Instalação'.
 */
function renderCombustivelSection() {
    const container = $('sec-combustivel');
    // Remove apenas os grupos de combustível antigos, preservando o container de anexos.
    container.querySelectorAll('.fuel-group').forEach(group => group.remove());

    const vendaSection = document.createElement('section');
    vendaSection.className = 'fuel-group';
    vendaSection.id = 'fuel-venda';

    const instalacaoSection = document.createElement('section');
    instalacaoSection.className = 'fuel-group';
    instalacaoSection.id = 'fuel-instalacao';

    const summaryContainer = container.querySelector('.section-summary');
    container.insertBefore(vendaSection, summaryContainer);
    container.insertBefore(instalacaoSection, summaryContainer);

    const { vendaItem, instalacaoItem } = getCombustivelItens();

    renderFuelGroup(vendaSection, 'venda', vendaItem);
    renderFuelGroup(instalacaoSection, 'instalacao', instalacaoItem);
}

/**
 * Extrai os itens de combustível de 'Venda' e 'Instalação' dos dados do projeto.
 * @returns {{vendaItem: object | null, instalacaoItem: object | null}}
 */
function getCombustivelItens() {
    const itens = (projectData.itens.combustivel || []).map(item => {
        if (typeof item === 'string') return parseLinhaParaItem(item);
        return item;
    }).filter(Boolean);

    const vendaItem = itens.find(i => i.finalidade === 'Venda') || null;
    const instalacaoItem = itens.find(i => i.finalidade === 'Instalação') || null;
    return { vendaItem, instalacaoItem };
}

/**
 * Renderiza um grupo específico de combustível (Venda ou Instalação).
 * @param {HTMLElement} section - O elemento container da seção.
 * @param {'venda' | 'instalacao'} type - O tipo de combustível.
 * @param {object | null} item - O objeto do item de combustível.
 */
function renderFuelGroup(section, type, item) {
    section.innerHTML = `<h4>Combustível — ${type === 'venda' ? 'Venda' : 'Instalação'}</h4>`;

    if (!item) {
        section.innerHTML += `<div class="empty-state-message">Nenhum item cadastrado.</div>`;
        const btnAdd = document.createElement('button');
        btnAdd.className = 'btn-action btn-add-fuel-item';
        btnAdd.title = 'Adicionar item de combustível';
        btnAdd.innerHTML = '<i class="fas fa-plus"></i>';
        btnAdd.onclick = () => modoEdicaoCombustivel(section, type, null);
        section.appendChild(btnAdd);
        return;
    }

    const isOwner = !item.user || item.user === currentUserUsername;
    if (!isOwner) {
        section.classList.add('not-owned');
        section.title = `Item criado por: ${item.user}. Você não pode editá-lo.`;
    }

    const row = document.createElement('div');
    row.className = 'item-row';
    if (!isOwner) {
        row.classList.add('not-owned');
    }

    let custo = 0;
    let detailsHTML = '';

    if (type === 'venda') {
        custo = (item.distancia * 2 / CONSUMO_FIXO) * item.valorLitro;
        detailsHTML = `
            <div class="item-details-breakdown">
                <span>Distância: <strong>${item.distancia} km</strong></span>
                <span>Preço/L: <strong>${formatCurrency(item.valorLitro)}</strong></span>
            </div>
        `;
    } else {
        custo = item.litros * item.valorLitro;
        detailsHTML = `
            <div class="item-details-breakdown">
                <span>Litros: <strong>${item.litros} L</strong></span>
                <span>Preço/L: <strong>${formatCurrency(item.valorLitro)}</strong></span>
            </div>
        `;
    }

    row.innerHTML = `
        <div class="item-details">
            <span>${item.descricao || 'Combustível'}</span><br>
            ${detailsHTML}
            <small class="meta-info owner-info">
                <i class="fas fa-user"></i> ${item.user || '?'} | <i class="fas fa-calendar-alt"></i> ${item.date ? new Date(item.date.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A'}
            </small>
        </div>
        <div class="item-value">${formatCurrency(custo)}</div>
    `;

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-action btn-edit';
    btnEdit.title = isOwner ? 'Editar item de combustível' : `Criado por ${item.user}`;
    btnEdit.innerHTML = '<i class="fas fa-edit"></i>';
    btnEdit.disabled = !isOwner;
    if (isOwner) {
        btnEdit.onclick = () => modoEdicaoCombustivel(section, type, item);
    }

    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-action btn-delete';
    btnDelete.title = isOwner ? 'Remover item de combustível' : `Criado por ${item.user}`;
    btnDelete.innerHTML = '<i class="fas fa-trash-alt"></i>';
    btnDelete.disabled = !isOwner;

    // PADRONIZAÇÃO: Usa a mesma lógica de listener das outras seções.
    btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btnDelete.dataset.confirmed) {
            removerItemCombustivel(type);
        } else {
            confirmAction(btnDelete, 'Remover?');
        }
    });

    row.append(btnEdit, btnDelete);
    section.appendChild(row);
}

/**
 * Entra no modo de edição para um item de combustível.
 * @param {HTMLElement} section - O elemento container da seção.
 * @param {'venda' | 'instalacao'} type - O tipo de combustível.
 * @param {object | null} item - O objeto do item de combustível.
 */
function modoEdicaoCombustivel(section, type, item) {
    clearAllConfirmations(); // Limpa o estado de confirmação (desbloqueia a UI)
    lockInterface(true); // Bloqueia a UI novamente, mas agora para o modo de edição.
    section.classList.add('editing');
    section.innerHTML = `<h4>Combustível — ${type === 'venda' ? 'Venda' : 'Instalação'}</h4>`;

    const content = document.createElement('div');
    content.className = 'fuel-content';

    const fields = {
        desc: { label: 'Descrição', id: `${type[0]}vd-desc`, type: 'text', value: item?.descricao || '' },
        ...(type === 'venda' ? {
            dist: { label: 'Distância (km)', id: 'fvd-dist', type: 'number', value: item?.distancia || '' },
            consumo: { label: 'Rendimento (km/L)', id: 'fvd-consumo', type: 'label', value: CONSUMO_FIXO },
            preco: { label: 'Preço do Combustível (R$/L)', id: 'fvd-preco', type: 'text', value: formatCurrency(item?.valorLitro || 0) }
        } : {
            litros: { label: 'Litros consumidos (L)', id: 'fid-litros', type: 'number', value: item?.litros || '' },
            preco: { label: 'Valor do litro (R$/L)', id: 'fid-preco', type: 'text', value: formatCurrency(item?.valorLitro || 0) }
        }),
        total: { label: 'Custo Total', id: `${type[0]}vd-total`, type: 'total', value: 'R$ 0,00' }
    };

    const inputs = {};
    for (const key in fields) {
        const field = fields[key];
        const fieldWrapper = document.createElement('div');
        fieldWrapper.className = 'form-field';
        fieldWrapper.innerHTML = `<label>${field.label}</label>`;

        if (field.type === 'label') {
            fieldWrapper.innerHTML += `<span id="${field.id}" class="unit-label">${field.value}</span>`;
        } else if (field.type === 'total') {
            fieldWrapper.innerHTML += `<strong id="${field.id}" class="fuel-custo">${field.value}</strong>`;
        } else {
            const input = document.createElement('input');
            input.id = field.id;
            input.type = field.type;
            input.value = field.value;
            if (field.type === 'text' && field.id.includes('preco')) input.className = 'monetary';
            if (input.className === 'monetary') input.addEventListener('input', () => formatarInputMonetario(input));
            fieldWrapper.appendChild(input);
            inputs[key] = input;
        }
        content.appendChild(fieldWrapper);
    }
    section.appendChild(content);

    const actions = document.createElement('div');
    actions.className = 'fuel-actions';
    const btnSave = document.createElement('button');
    btnSave.className = 'btn-action btn-save success';
    btnSave.title = 'Salvar';
    btnSave.innerHTML = '<i class="fas fa-save"></i>';
    btnSave.disabled = true;
    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn-action btn-cancel-edit danger';
    btnCancel.title = 'Cancelar';
    btnCancel.innerHTML = '<i class="fas fa-times"></i>';
    actions.append(btnSave, btnCancel);
    section.appendChild(actions);

    // REVISÃO PROFUNDA: Reabilita explicitamente os botões recém-criados.
    enableActionsWithin(actions);

    const totalEl = $(fields.total.id);
    const validations = [
        { element: inputs.desc, type: 'description', get value() { return inputs.desc.value; } }
    ];

    if (type === 'venda') {
        validations.push({ element: inputs.dist, type: 'numeric', get value() { return parseFloat(inputs.dist.value); } });
        validations.push({ element: inputs.preco, type: 'money', get value() { return parseCurrency(inputs.preco.value); } });
    } else {
        validations.push({ element: inputs.litros, type: 'numeric', get value() { return parseFloat(inputs.litros.value); } });
        validations.push({ element: inputs.preco, type: 'money', get value() { return parseCurrency(inputs.preco.value); } });
    }

    const validateAndRecalculate = () => {
        let total = 0;
        if (type === 'venda') {
            total = (parseFloat(inputs.dist.value) * 2 / CONSUMO_FIXO) * parseCurrency(inputs.preco.value);
        } else {
            total = parseFloat(inputs.litros.value) * parseCurrency(inputs.preco.value);
        }
        totalEl.textContent = formatCurrency(total || 0);

        const { vendaItem: vItem, instalacaoItem: iItem } = getCombustivelItens();
        let custoVenda = 0;
        let custoInstalacao = 0;

        if (type === 'venda') {
            custoVenda = total || 0;
            custoInstalacao = iItem ? iItem.litros * iItem.valorLitro : 0;
        } else {
            custoInstalacao = total || 0; // Usa o valor que está sendo calculado em tempo real
            custoVenda = vItem ? (vItem.distancia * 2 / CONSUMO_FIXO) * vItem.valorLitro : 0; // Pega o valor do outro item
        }
        $('total-combustivel').textContent = formatCurrency(custoVenda + custoInstalacao);

        btnSave.disabled = !validarCampos(validations);
    };

    Object.values(inputs).forEach(input => input.addEventListener('input', validateAndRecalculate));
    validateAndRecalculate();

    btnCancel.addEventListener('click', (e) => {
        lockInterface(false);
        section.classList.remove('editing');
        renderFuelGroup(section, type, item);
        atualizarTotalCombustivel();
    });

    // PADRONIZAÇÃO: Adiciona a confirmação ao botão Salvar.
    btnSave.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btnSave.dataset.confirmed) {
            const newItemData = { id: item?.id || Date.now(), finalidade: type === 'venda' ? 'Venda' : 'Instalação', descricao: inputs.desc.value };
            if (type === 'venda') {
                newItemData.distancia = parseFloat(inputs.dist.value);
                newItemData.valorLitro = parseCurrency(inputs.preco.value);
                newItemData.custo = arredondarParaDuasCasas((newItemData.distancia * 2 / CONSUMO_FIXO) * newItemData.valorLitro);
            } else {
                newItemData.litros = parseFloat(inputs.litros.value);
                newItemData.valorLitro = parseCurrency(inputs.preco.value);
                newItemData.custo = arredondarParaDuasCasas(newItemData.litros * newItemData.valorLitro);
            }

            const { vendaItem, instalacaoItem } = getCombustivelItens();
            const otherItem = type === 'venda' ? instalacaoItem : vendaItem;
            if (otherItem && !otherItem.custo) {
                otherItem.custo = otherItem.finalidade === 'Venda' 
                    ? arredondarParaDuasCasas((otherItem.distancia * 2 / CONSUMO_FIXO) * otherItem.valorLitro)
                    : arredondarParaDuasCasas(otherItem.litros * otherItem.valorLitro);
            }
            const newCombustivelItens = [{...newItemData, user: currentUserUsername}];
            if (otherItem) newCombustivelItens.push(otherItem);
        
            const today = new Date().toLocaleDateString('sv-SE');
            const itensParaApi = newCombustivelItens.map(item => ({
                ...item,
                date: item.date ? new Date(item.date.split('T')[0] + 'T12:00:00').toLocaleDateString('sv-SE') : today,
            }));
            const payloadJson = JSON.stringify(itensParaApi);
            salvarDadosCombustivel(payloadJson, newCombustivelItens);
        } else {
            confirmAction(btnSave, 'Salvar?');
        }
    });
}

/**
 * Salva os dados de combustível (texto e total) na API.
 * @param {string} payloadJson - A string JSON com todos os itens de combustível.
 * @param {Array<object>} newCombustivelItens - A lista de objetos de itens de combustível.
 */
async function salvarDadosCombustivel(payloadJson, newCombustivelItens) {
        mostrarLoading(true);
        try {
            await atualizarCampoUnico(projectId, API_KEYS.COMBUSTIVEL, payloadJson, projectData.fieldIds);

            const novoCustoVenda = newCombustivelItens.find(i => i.finalidade === 'Venda');
            const novoCustoInstalacao = newCombustivelItens.find(i => i.finalidade === 'Instalação');

            const custoVenda = novoCustoVenda ? (novoCustoVenda.distancia * 2 / CONSUMO_FIXO) * novoCustoVenda.valorLitro : 0;
            const custoInstalacao = novoCustoInstalacao ? novoCustoInstalacao.litros * novoCustoInstalacao.valorLitro : 0;
            const totalCombustivel = arredondarParaDuasCasas(custoVenda + custoInstalacao);

            await atualizarCampoUnico(projectId, API_KEYS.TOTAL_COMBUSTIVEL, totalCombustivel.toString(), projectData.fieldIds);

            await refreshDataAndUI();

        } catch (error) {
            console.error("Falha ao salvar dados de combustível:", error);
            alert("Ocorreu um erro ao salvar os dados de combustível. Tente novamente.");
        } finally {
            lockInterface(false); // Desbloqueia a UI em caso de sucesso ou falha
            mostrarLoading(false);
        }
}

/**
 * Remove um item de combustível (Venda ou Instalação) e atualiza a API.
 * @param {'venda' | 'instalacao'} typeToRemove - O tipo de item a ser removido.
 */
async function removerItemCombustivel(typeToRemove) {
    const { vendaItem, instalacaoItem } = getCombustivelItens();
    const remainingItem = typeToRemove === 'venda' ? instalacaoItem : vendaItem;

    // CORREÇÃO: Gera a data local para evitar problemas de fuso horário.
    const today = new Date().toLocaleDateString('sv-SE'); // Formato YYYY-MM-DD
    console.log(`[removerItemCombustivel] Data local gerada (today): ${today}`);

    const newCombustivelItens = remainingItem ? [{
        ...remainingItem,
        date: remainingItem.date ? new Date(remainingItem.date.split('T')[0] + 'T12:00:00').toLocaleDateString('sv-SE') : today
    }] : [];

    const payloadJson = JSON.stringify(newCombustivelItens);
    console.log(`[removerItemCombustivel] Payload JSON para API (combustível):\n`, payloadJson);

    await salvarDadosCombustivel(payloadJson, newCombustivelItens);
}

/**
 * Função de inicialização principal da página do editor.
 */
async function init() {
  const params = new URLSearchParams(window.location.search);
  projectId = params.get('projectId');
  mostrarLoading(true);

  if (!projectId) {
    alert('ID do projeto não fornecido.');
    window.location.href = 'index.html';
    return;
  }
  
  // Pega o nome de usuário salvo no localStorage durante o login
  currentUserUsername = localStorage.getItem('username');
  const elUsernameEdit = $('username-edit');
  if (currentUserUsername && elUsernameEdit) {
    elUsernameEdit.textContent = currentUserUsername;
  }

  try {
    // Valida a sessão com a API para garantir que o token ainda é válido
    const userData = await getMe();
    if (!userData.sucesso || !userData.user) {
      throw new Error('Token inválido ou expirado.');
    }

    // Atualiza o currentUserUsername com a versão reduzida do email (fonte da verdade)
    if (userData.user.email) {
      currentUserUsername = userData.user.email.split('@')[0];
      if (elUsernameEdit) elUsernameEdit.textContent = currentUserUsername;
    }
  } catch (authError) {
    alert('Sua sessão expirou. Por favor, faça login novamente.');
    window.location.href = 'index.html';
  }

  try {
    projectData = await buscarEProcessarProjeto(projectId);
    if (!projectData) {
      alert('Projeto não encontrado.');
      window.location.href = 'index.html';
      return;
    }
  } catch (error) {
    console.error("Erro na inicialização:", error);
    alert("Falha ao carregar os dados do projeto. Verifique o console e tente novamente.");
  } finally {
    mostrarLoading(false);
  }

  const uiInitialized = initializeEditorUI();
  if (!uiInitialized) {
    console.error("UI não inicializada, abortando carregamento.");
    return;
  }

  loadAllSections();
  setupEventListeners();

  Object.values(KEYS).forEach(atualizarTotal);
  atualizarTotalCombustivel();

  $('editor-container')?.classList.remove('oculto');
  
  $('editor-title').textContent = 'Custos';
  $('editor-subtitle').textContent = `#${projectData.id} - ${projectData.nomeCliente}`;

  document.querySelector('.tab-link')?.classList.add('active');
  document.querySelector('.editor-section')?.classList.add('active');
}

/**
 * Calcula e atualiza o total da aba de combustível.
 */
function atualizarTotalCombustivel() {
    const { vendaItem, instalacaoItem } = getCombustivelItens();
    const custoVenda = vendaItem ? (vendaItem.distancia * 2 / CONSUMO_FIXO) * vendaItem.valorLitro : 0;
    const custoInstalacao = instalacaoItem ? instalacaoItem.litros * instalacaoItem.valorLitro : 0;
    $('total-combustivel').textContent = formatCurrency(custoVenda + custoInstalacao);
}

document.addEventListener('DOMContentLoaded', init);