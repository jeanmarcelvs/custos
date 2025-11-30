import { formatarMoeda as formatCurrency, converterStringParaNumero as parseCurrency, formatarNumeroParaBR, parseLinhaParaItem, formatarInputMonetario, arredondarParaDuasCasas } from './utils.js';
import { buscarEProcessarProjeto, atualizarCampoUnico, KEYS as API_KEYS, getMe } from './model.js';

// Helper para selecionar elementos por ID
const $ = (id) => document.getElementById(id);

const KEYS = {
  DESPESAS_PROJETO: 'despProjeto',
  DESPESAS_FIXAS: 'despFixasGerais',
  MATERIAL: 'material',
  FERRAMENTA: 'ferramenta',
  DIARIAS: 'diarias',
  ALIMENTACAO: 'alimentacao', // Esta chave não tem uma lista de itens no model, apenas um total.
  INDICACAO: 'indicacao',
  COMBUSTIVEL: 'combustivel',
};

const CONSUMO_FIXO = 10.6; // km/L

let projectData = {};
let projectId = null;
let currentUserUsername = null; // NOVO: Armazena o nome de usuário logado
let overlay; // Será inicializado no init

function mostrarLoading(sim = true) {
  if (!overlay) overlay = $('loading-overlay');
  overlay?.classList.toggle('oculto', !sim);
}

function initializeEditorUI() {
  const editorSections = $('editor-sections');
  // Verificação de segurança para garantir que o container existe.
  if (!editorSections) {
    console.error("ERRO CRÍTICO: O container 'editor-sections' não foi encontrado no DOM.");
    return false; // Retorna false em caso de falha
  }

  const sections = [
    { title: 'Projeto', key: KEYS.DESPESAS_PROJETO, listId: 'lista-despesas-projeto' },
    { title: 'Fixa/Admin', key: KEYS.DESPESAS_FIXAS, listId: 'lista-despFixasGerais' },
    { title: 'Indicação', key: KEYS.INDICACAO, listId: 'lista-indicacao' },
    { title: 'Material Inst.', key: KEYS.MATERIAL, listId: 'lista-material' },
    { title: 'Diárias/M.O.', key: KEYS.DIARIAS, listId: 'lista-diarias' },
    { title: 'Aluguel', key: KEYS.FERRAMENTA, listId: 'lista-ferramenta' }
  ];

  // Cria a navegação das abas e o container para o conteúdo
  const tabsNavHTML = `
    <div class="tabs-nav">
      ${sections.map((s, index) => `<button class="tab-link ${index === 0 ? 'active' : ''}" data-tab="sec-${s.listId.replace('lista-', '')}">${s.title}</button>`).join('')}
      <button class="tab-link" data-tab="sec-combustivel">Combustível</button><button class="tab-link" data-tab="sec-alimentacao">Alimentação</button>
    </div>
  `;

  const tabsContentHTML = `
    <div class="tabs-content">
      ${sections.map(s => `
        <div class="editor-section" id="sec-${s.listId.replace('lista-', '')}" data-key="${s.key}" data-container="${s.listId}">
          <div id="${s.listId}"></div>
          <div class="controls">
            <button class="btn-action btn-add-item" title="Adicionar item"><i class="fas fa-plus"></i></button>
          </div>
          <div class="section-summary">
            <div class="group-total"><span>Total</span><strong id="total-${s.key}">R$ 0,00</strong></div>
            <div class="attachment-list" id="attachments-${s.key}"></div>
          </div>
        </div>
      `).join('')}
      <div class="editor-section" id="sec-combustivel" data-key="combustivel">
        <div class="section-summary">
          <div class="group-total"><span>Total</span><strong id="total-combustivel">R$ 0,00</strong></div>
          <div class="attachment-list" id="attachments-combustivel"></div>
        </div>
      </div>
      <div class="editor-section" id="sec-alimentacao" data-key="alimentacao" data-container="lista-alimentacao">
        <div id="lista-alimentacao"></div>
        <div class="controls">
          <button class="btn-action btn-add-item" title="Adicionar item"><i class="fas fa-plus"></i></button>
        </div>
        <div class="section-summary">
          <div class="group-total"><span>Total</span><strong id="total-alimentacao">R$ 0,00</strong></div>
          <div class="attachment-list" id="attachments-alimentacao"></div>
        </div>
      </div>
    </div>
  `;

  editorSections.innerHTML = tabsNavHTML + tabsContentHTML;

  // Garante que os dados sejam carregados e os eventos configurados APÓS o HTML estar no DOM.
  loadAllSections();
  setupEventListeners();
  return true; // Retorna true em caso de sucesso
}

/**
 * NOVO: Renderiza a lista de comprovantes para todas as seções.
 */
function renderizarComprovantes() {
    // CORREÇÃO: O mapa agora usa as chaves locais (como 'combustivel') em vez das chaves da API.
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
        const containerId = `attachments-${localKey}`;
        const container = $(containerId);

        if (container && projectData.rawFields && projectData.rawFields[apiKey]) {
            // CORREÇÃO: Garante que o valor seja tratado como string antes de usar .split()
            const valorComoString = String(projectData.rawFields[apiKey] || '');
            const urls = valorComoString.split('\n').filter(url => url.trim() !== '');
            if (urls.length > 0) {
                container.innerHTML = '<h4>Comprovantes</h4>';
                const list = document.createElement('ul');
                urls.forEach(url => {
                    const listItem = document.createElement('li');
                    const link = document.createElement('a');
                    link.href = url;
                    link.textContent = url.substring(url.lastIndexOf('/') + 1); // Mostra apenas o nome do arquivo
                    link.target = '_blank'; // Abre em nova aba
                    listItem.appendChild(link);
                    list.appendChild(listItem);
                });
                container.appendChild(list);
            }
        }
    }
}

function setupEventListeners() {
  $('btn-voltar').addEventListener('click', () => {
    window.location.href = `projeto.html?projectId=${projectId}`; // Manter o botão voltar
  });

  // Lógica para troca de abas
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabPanes = document.querySelectorAll('.editor-section');

  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      const tabId = link.dataset.tab;

      tabLinks.forEach(l => l.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      link.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });

  document.querySelectorAll('.btn-add-item').forEach(button => {
    button.addEventListener('click', (e) => {
      const section = e.currentTarget.closest('.editor-section');
      const key = section.dataset.key;
      adicionarItem(key);
    });
  });
}

function loadAllSections() {
  // Recria a mesma estrutura de seções para garantir consistência
  const sections = [
    { key: KEYS.DESPESAS_PROJETO, listId: 'lista-despesas-projeto' },
    { key: KEYS.DESPESAS_FIXAS, listId: 'lista-despFixasGerais' },
    { key: KEYS.INDICACAO, listId: 'lista-indicacao' },
    { key: KEYS.MATERIAL, listId: 'lista-material' },
    { key: KEYS.DIARIAS, listId: 'lista-diarias' },
    { key: KEYS.FERRAMENTA, listId: 'lista-ferramenta' }
  ];

  sections.forEach(section => {
    const listaContainer = $(section.listId);
    if (listaContainer) {
      popularLista(section.key, listaContainer);
    }
  });
  // Carrega a seção de alimentação separadamente, pois agora ela está fora do array principal
  const alimentacaoContainer = $('lista-alimentacao');
  if (alimentacaoContainer) {
    popularLista(KEYS.ALIMENTACAO, alimentacaoContainer);
  }

  renderCombustivelSection();
  renderizarComprovantes(); // NOVO: Renderiza os comprovantes para todas as seções.
}

/**
 * NOVO: Função centralizada para recarregar dados da API e atualizar a UI,
 * preservando a aba ativa.
 */
async function refreshDataAndUI() {
    // 1. Salva a aba ativa
    const activeTabLink = document.querySelector('.tab-link.active');
    const activeTabId = activeTabLink ? activeTabLink.dataset.tab : null;

    mostrarLoading(true);
    try {
        // 2. Busca os dados mais recentes
        projectData = await buscarEProcessarProjeto(projectId);
        if (!projectData) throw new Error("Não foi possível recarregar os dados do projeto.");

        console.group(`[DEBUG RELOAD]`);
        console.log("[D] Dados recebidos do GET (após recarga):");
        console.log(JSON.parse(JSON.stringify(projectData.itens)));
        console.groupEnd();

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
function popularLista(key, listaContainer) {
  listaContainer.innerHTML = '';
  const itens = projectData.itens[key] || [];
  
  itens.forEach(item => {
    const rowElement = criarLinhaItemExistente(item, key);
    listaContainer.appendChild(rowElement);
  });

  verificarEstadoVazio(key); // Garante que o estado vazio seja verificado após popular
}

function adicionarItem(key) {
  const section = document.querySelector(`.editor-section[data-key="${key}"]`);
  const listaContainer = section ? $(section.dataset.container) : null;

  if (!listaContainer) return;

  // Remove a mensagem de estado vazio, se existir
  const emptyState = listaContainer.querySelector('.empty-state-message');
  if (emptyState) {
    emptyState.remove();
  }

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

function criarLinhaItemExistente(item, key) {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.dataset.itemId = item.id;

    // LÓGICA DE PROPRIEDADE: Verifica se o usuário logado é o dono do item.
    // Itens sem 'user' (antigos) podem ser editados por qualquer um.
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
                    <i class="fas fa-user"></i> ${item.user || '?'} | <i class="fas fa-calendar-alt"></i> ${item.date ? new Date(item.date).toLocaleDateString('pt-BR') : 'N/A'}
                </small>
            </div>
            <div class="item-value">${formatCurrency(item.valor)}</div>
        `;
    } else {
        row.innerHTML = `
            <div class="item-details">
                <span>${item.descricao || 'Sem descrição'}</span><br>
                <small class="meta-info owner-info">
                    <i class="fas fa-user"></i> ${item.user || '?'} | <i class="fas fa-calendar-alt"></i> ${item.date ? new Date(item.date).toLocaleDateString('pt-BR') : 'N/A'}
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

    // Lógica de confirmação aprimorada para o botão de deletar
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
            btnDelete.innerHTML = '<i class="fas fa-check"></i> Confirmar?'; // Texto explícito
            
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

function criarLinhaItemNovo(item, key) {
    const row = document.createElement('div');
    row.className = 'item-row editing';
    row.dataset.itemId = item.id;
    return row;
}

function validarCampos(validations) {
    let allValid = true;
    for (const { element, type, value } of validations) {
        let isValid = false;
        switch (type) {
            case 'description': // Validação de descrição
                // Pelo menos 3 letras, pode conter números, mas não apenas números. Sem caracteres especiais.
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

function setupValidation(inputs, saveButton) {
    inputs.forEach(input => {
        input.element.addEventListener('input', () => saveButton.disabled = !validarCampos(inputs));
    });
}

function modoEdicao(item, rowElement, opts = {}) {
    lockInterface(true); // << NOVO: Bloqueia a interface
    const key = rowElement.closest('.editor-section').dataset.key;
    rowElement.classList.add('editing');
    
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

    // Adiciona a máscara monetária inteligente
    inpValor.addEventListener('input', () => {
        formatarInputMonetario(inpValor);
        atualizarTotalDinamico(key); // Atualiza o total da seção em tempo real
    });

    const btnSave = document.createElement('button');
    btnSave.className = 'btn-action btn-save success'; // Adicionado 'success' para cor verde
    btnSave.innerHTML = '<i class="fas fa-save"></i>';

    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn-action btn-cancel-edit danger'; // Adicionado 'danger' para cor vermelha
    btnCancel.innerHTML = '<i class="fas fa-times"></i>'; // Ícone de fechar/cancelar
    
    btnSave.disabled = true; // Desabilitado por padrão

    const validations = [
        { element: inpDesc, type: 'description', get value() { return inpDesc.value; } },
        { element: inpValor, type: 'money', get value() { return parseCurrency(inpValor.value); } }
    ];

    setupValidation(validations, btnSave);
    setTimeout(() => btnSave.disabled = !validarCampos(validations), 0); // Validação inicial

    // Lógica de confirmação para o botão salvar
    btnSave.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btnSave.classList.contains('confirm-save')) {
            const valorArredondado = arredondarParaDuasCasas(parseCurrency(inpValor.value));
            salvarItem(key, item.id, { descricao: inpDesc.value, valor: valorArredondado }, rowElement);
            lockInterface(false);
        } else {
            const originalHTML = btnSave.innerHTML;
            btnSave.classList.add('confirm-save');
            btnSave.innerHTML = '<i class="fas fa-check"></i> Salvar?';

            const revert = () => {
                if (btnSave.classList.contains('confirm-save')) {
                    btnSave.classList.remove('confirm-save');
                    btnSave.innerHTML = originalHTML;
                }
                document.removeEventListener('click', revert);
            };

            setTimeout(revert, 3000);
            document.addEventListener('click', revert, { once: true });
        }
    });
    btnCancel.addEventListener('click', () => {
        if (opts.isNew) rowElement.remove();
        else cancelarEdicao(item, rowElement, key);
        lockInterface(false); // << NOVO: Libera a interface ao cancelar
        verificarEstadoVazio(key);
        atualizarTotalDinamico(key); // NOVO: Reverte o total ao valor original.
    });

    rowElement.innerHTML = '';
    rowElement.append(inpDesc, inpValor, btnSave, btnCancel);
    inpDesc.focus();
}

/**
 * NOVO: Atualiza o total de uma seção lendo os valores diretamente do DOM.
 * Isso permite o cálculo em tempo real durante a edição.
 * @param {string} key - A chave da seção (ex: 'material', 'diarias').
 */
function atualizarTotalDinamico(key) {
    const section = document.querySelector(`.editor-section[data-key="${key}"]`);
    if (!section) return;

    const listaContainer = $(section.dataset.container);
    if (!listaContainer) return;

    let total = 0;
    const rows = listaContainer.querySelectorAll('.item-row');

    rows.forEach(row => {
        // Seletor ajustado para pegar o campo de valor pelo placeholder ou o campo que não é de descrição.
        const inputValor = row.querySelector('input.item-input[placeholder="R$ 0,00"]');
        const displayValor = row.querySelector('.item-value');
        total += parseCurrency(inputValor ? inputValor.value : (displayValor ? displayValor.textContent : '0'));
    });

    $(`total-${key}`).textContent = formatCurrency(total);
}

function modoEdicaoIndicador(item, rowElement, opts = {}) {
    lockInterface(true); // << NOVO: Bloqueia a interface
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

    // Adiciona a máscara monetária inteligente
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
        { element: inpNome, type: 'description', get value() { return inpNome.value; } },
        { element: inpTelefone, type: 'numeric', get value() { return inpTelefone.value.replace(/\D/g,''); } }, // Simplificado
        { element: inpValor, type: 'money', get value() { return parseCurrency(inpValor.value); } }
    ];

    setupValidation(validations, btnSave);
    setTimeout(() => btnSave.disabled = !validarCampos(validations), 0); // Validação inicial

    // Lógica de confirmação para o botão salvar
    btnSave.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btnSave.classList.contains('confirm-save')) {
            const valorArredondado = arredondarParaDuasCasas(parseCurrency(inpValor.value));
            salvarItem(key, item.id, { nome: inpNome.value, telefone: inpTelefone.value, valor: valorArredondado }, rowElement);
            lockInterface(false);
        } else {
            const originalHTML = btnSave.innerHTML;
            btnSave.classList.add('confirm-save');
            btnSave.innerHTML = '<i class="fas fa-check"></i> Salvar?';

            const revert = () => {
                if (btnSave.classList.contains('confirm-save')) {
                    btnSave.classList.remove('confirm-save');
                    btnSave.innerHTML = originalHTML;
                }
                document.removeEventListener('click', revert);
            };
            setTimeout(revert, 3000);
            document.addEventListener('click', revert, { once: true });
        }
    });
    btnCancel.addEventListener('click', () => {
        if (opts.isNew) rowElement.remove();
        else cancelarEdicao(item, rowElement, key);
        lockInterface(false); // << NOVO: Libera a interface ao cancelar
        verificarEstadoVazio(key);
        atualizarTotalDinamico(key); // NOVO: Reverte o total ao valor original.
    });

    rowElement.innerHTML = '';
    rowElement.append(inpNome, inpTelefone, inpValor, btnSave, btnCancel);
    inpNome.focus();
}

async function salvarItem(key, itemId, data, rowElement) {
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

    // Determina qual campo da API deve ser atualizado
    const localKeyName = Object.keys(KEYS).find(k => KEYS[k] === key);
    if (!localKeyName) return; // Chave local não encontrada, não fazer nada.

    // Salva o campo atualizado na API e recarrega os dados do projeto
    try {
        // Lógica unificada para todas as abas.
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const textoParaApi = projectData.itens[key].map(i => {
            // A aba de indicação tem um formato de texto diferente.
            if (key === KEYS.INDICACAO) {
                // CORREÇÃO: Usa o 'user' existente do item, ou o usuário atual se for um item novo.
                return `${i.user || currentUserUsername} | ${i.id === itemId ? today : i.date} | ${i.nome || ''} | ${i.telefone || ''} | ${formatarNumeroParaBR(i.valor)}`;
            }
            // CORREÇÃO: Usa o 'user' existente do item, ou o usuário atual se for um item novo.
            return `${i.user || currentUserUsername} | ${i.id === itemId ? today : i.date} | ${i.descricao || ''} | ${formatarNumeroParaBR(i.valor)}`;
        }).join('\n');

        const fieldKey = API_KEYS[localKeyName.toUpperCase()];
        await atualizarCampoUnico(projectId, fieldKey, textoParaApi, projectData.fieldIds);

        const somaBruta = projectData.itens[key].reduce((acc, item) => acc + (item.valor || 0), 0);
        const total = arredondarParaDuasCasas(somaBruta);
        const totalFieldKey = API_KEYS[`TOTAL_${localKeyName.toUpperCase()}`];
        if (totalFieldKey) {
            await atualizarCampoUnico(projectId, totalFieldKey, total.toString(), projectData.fieldIds);
        }
    } catch (error) {
        console.error("Falha ao salvar item:", error);
        alert("Ocorreu um erro ao salvar. Tente novamente.");
    }

    // Atualiza toda a UI com os dados mais recentes, mantendo a aba ativa.
    await refreshDataAndUI();
}

function cancelarEdicao(item, rowElement, key) {
    rowElement.classList.remove('editing');
    const originalRow = criarLinhaItemExistente(item, key);
    rowElement.replaceWith(originalRow);
}

async function removerItem(key, itemId) {
    if (!projectData.itens[key]) return;

    projectData.itens[key] = projectData.itens[key].filter(i => i.id !== itemId);

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const textoParaApi = projectData.itens[key].map(i => {
        if (key === KEYS.INDICACAO) {
            // CORREÇÃO: Usa o 'user' existente do item para preservar a propriedade.
            return `${i.user || currentUserUsername} | ${i.date || today} | ${i.nome || ''} | ${i.telefone || ''} | ${formatarNumeroParaBR(i.valor)}`;
        } else {
            // CORREÇÃO: Usa o 'user' existente do item para preservar a propriedade.
            return `${i.user || currentUserUsername} | ${i.date || today} | ${i.descricao || ''} | ${formatarNumeroParaBR(i.valor)}`;
        }
    }).join('\n');

    const localKeyName = Object.keys(KEYS).find(k => KEYS[k] === key);
    if (!localKeyName) return; // Chave local não encontrada, não fazer nada.

    const fieldKey = API_KEYS[localKeyName.toUpperCase()];

    try {
        mostrarLoading(true);
        await atualizarCampoUnico(projectId, fieldKey, textoParaApi, projectData.fieldIds);

        // CORREÇÃO: Calcula e salva o campo de TOTAL correspondente após a remoção
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
        // Atualiza toda a UI com os dados mais recentes, mantendo a aba ativa.
        await refreshDataAndUI();
    }
}

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

function atualizarTotal(key) {
  const itens = projectData.itens[key] || [];
  const total = itens.reduce((acc, item) => acc + (item.valor || 0), 0);
  const totalElement = $(`total-${key}`);
  if (totalElement) {
    totalElement.textContent = formatCurrency(total);
  }
}

function lockInterface(lock = true) {
    document.body.classList.toggle('is-locked-for-editing', lock);
}

function renderCombustivelSection() {
    const container = $('sec-combustivel');
    // CORREÇÃO: Remove apenas os grupos de combustível antigos, preservando o container de anexos.
    container.querySelectorAll('.fuel-group').forEach(group => group.remove());

    const vendaSection = document.createElement('section');
    vendaSection.className = 'fuel-group';
    vendaSection.id = 'fuel-venda';

    const instalacaoSection = document.createElement('section');
    instalacaoSection.className = 'fuel-group';
    instalacaoSection.id = 'fuel-instalacao';

    // Insere os novos grupos de combustível no início do container da aba.
    const summaryContainer = container.querySelector('.section-summary');
    container.insertBefore(vendaSection, summaryContainer);
    container.insertBefore(instalacaoSection, summaryContainer);

    const { vendaItem, instalacaoItem } = getCombustivelItens();

    renderFuelGroup(vendaSection, 'venda', vendaItem);
    renderFuelGroup(instalacaoSection, 'instalacao', instalacaoItem);
}

function getCombustivelItens() {
    const itens = (projectData.itens.combustivel || []).map(item => {
        if (typeof item === 'string') return parseLinhaParaItem(item);
        return item;
    }).filter(Boolean);

    const vendaItem = itens.find(i => i.finalidade === 'Venda') || null;
    const instalacaoItem = itens.find(i => i.finalidade === 'Instalação') || null;
    return { vendaItem, instalacaoItem };
}

function renderFuelGroup(section, type, item) {
    section.innerHTML = `<h4>Combustível — ${type === 'venda' ? 'Venda' : 'Instalação'}</h4>`;

    if (!item) {
        section.innerHTML += `<div class="empty-state-message">Nenhum item cadastrado.</div>`;
        const btnAdd = document.createElement('button');
        btnAdd.className = 'btn-action btn-add-fuel-item'; // Classe específica para evitar conflito
        btnAdd.title = 'Adicionar item de combustível';
        btnAdd.innerHTML = '<i class="fas fa-plus"></i>';
        btnAdd.onclick = () => modoEdicaoCombustivel(section, type, null);
        section.appendChild(btnAdd);
        return;
    }

    // LÓGICA DE PROPRIEDADE: Verifica se o usuário logado é o dono do item.
    const isOwner = !item.user || item.user === currentUserUsername;

    if (!isOwner) {
        // Adiciona a classe ao grupo de combustível para feedback visual
        section.classList.add('not-owned');
        section.title = `Item criado por: ${item.user}. Você não pode editá-lo.`;
    }

    // CORREÇÃO: Cria uma estrutura de linha de item consistente com as outras abas.
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
    } else { // instalacao
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
                <i class="fas fa-user"></i> ${item.user || '?'} | <i class="fas fa-calendar-alt"></i> ${item.date ? new Date(item.date).toLocaleDateString('pt-BR') : 'N/A'}
            </small>
        </div>
        <div class="item-value">${formatCurrency(custo)}</div>
    `;

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-action btn-edit';
    btnEdit.title = isOwner ? 'Editar item de combustível' : `Criado por ${item.user}`;
    btnEdit.innerHTML = '<i class="fas fa-edit"></i>';
    btnEdit.disabled = !isOwner; // Desabilita o botão se não for o dono
    if (isOwner) {
        btnEdit.onclick = () => modoEdicaoCombustivel(section, type, item);
    }

    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-action btn-delete';
    btnDelete.title = isOwner ? 'Remover item de combustível' : `Criado por ${item.user}`;
    btnDelete.innerHTML = '<i class="fas fa-trash-alt"></i>';
    btnDelete.disabled = !isOwner; // Desabilita o botão se não for o dono
    btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btnDelete.classList.contains('confirm-delete')) {
            removerItemCombustivel(type);
        } else {
            const originalHTML = btnDelete.innerHTML;
            btnDelete.classList.add('confirm-delete');
            btnDelete.innerHTML = '<i class="fas fa-check"></i> Confirmar?';

            const revert = () => {
                btnDelete.classList.remove('confirm-delete');
                btnDelete.innerHTML = originalHTML;
                document.removeEventListener('click', revert);
            };
            setTimeout(revert, 3000);
            document.addEventListener('click', revert, { once: true });
        }
    });

    row.append(btnEdit, btnDelete);
    section.appendChild(row);
}

function modoEdicaoCombustivel(section, type, item) {
    lockInterface(true);
    section.classList.add('editing'); // << NOVO: Adiciona a classe de edição ao grupo
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

        // NOVO: Atualiza o total geral da aba de combustível em tempo real.
        const { vendaItem: vItem, instalacaoItem: iItem } = getCombustivelItens();
        let custoVenda = 0;
        let custoInstalacao = 0;

        if (type === 'venda') {
            custoVenda = total || 0; // Usa o valor que está sendo calculado em tempo real
            custoInstalacao = iItem ? iItem.litros * iItem.valorLitro : 0; // Pega o valor do outro item
        } else {
            custoInstalacao = total || 0; // Usa o valor que está sendo calculado em tempo real
            custoVenda = vItem ? (vItem.distancia * 2 / CONSUMO_FIXO) * vItem.valorLitro : 0; // Pega o valor do outro item
        }
        $('total-combustivel').textContent = formatCurrency(custoVenda + custoInstalacao);

        btnSave.disabled = !validarCampos(validations);
    };

    Object.values(inputs).forEach(input => input.addEventListener('input', validateAndRecalculate));
    validateAndRecalculate();

    btnCancel.addEventListener('click', () => {
        lockInterface(false);
        section.classList.remove('editing'); // << NOVO: Remove a classe ao cancelar
        renderFuelGroup(section, type, item);
        atualizarTotalCombustivel(); // NOVO: Garante que o total da aba seja revertido.
    });

    // Lógica de confirmação aprimorada para o botão salvar de combustível
    btnSave.addEventListener('click', (e) => {
        e.stopPropagation();

        if (btnSave.classList.contains('confirm-save')) {
            // Segundo clique: executa a ação de salvar
            const newItemData = { finalidade: type === 'venda' ? 'Venda' : 'Instalação', descricao: inputs.desc.value };
            if (type === 'venda') {
                newItemData.distancia = parseFloat(inputs.dist.value);
                newItemData.valorLitro = parseCurrency(inputs.preco.value);
            } else {
                newItemData.litros = parseFloat(inputs.litros.value);
                newItemData.valorLitro = parseCurrency(inputs.preco.value);
            }

            const { vendaItem, instalacaoItem } = getCombustivelItens();
            const otherItem = type === 'venda' ? instalacaoItem : vendaItem;
            const newCombustivelItens = [{...newItemData, user: currentUserUsername}]; // Adiciona o usuário
            if (otherItem) newCombustivelItens.push(otherItem);
            
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const textoParaApi = newCombustivelItens.map(item => {
                if (item.finalidade === 'Venda') return `${item.user} | ${item.date || today} | ${item.finalidade} | ${item.descricao} | ${item.distancia} | ${CONSUMO_FIXO} | ${formatarNumeroParaBR(item.valorLitro)} | ${formatarNumeroParaBR((item.distancia * 2 / CONSUMO_FIXO) * item.valorLitro)}`;
                return `${item.user} | ${item.date || today} | ${item.finalidade} | ${item.descricao} | ${item.litros} | 0 | ${formatarNumeroParaBR(item.valorLitro)} | ${formatarNumeroParaBR(item.litros * item.valorLitro)}`;
            }).join('\n');

            salvarDadosCombustivel(textoParaApi, newCombustivelItens);

        } else {
            // Primeiro clique: arma o botão
            const originalHTML = btnSave.innerHTML;
            btnSave.classList.add('confirm-save');
            btnSave.innerHTML = '<i class="fas fa-check"></i> Salvar?';

            const revert = () => {
                btnSave.classList.remove('confirm-save');
                btnSave.innerHTML = originalHTML;
                document.removeEventListener('click', revert);
            };
            setTimeout(revert, 3000);
            document.addEventListener('click', revert, { once: true });
        }
    });
}

async function salvarDadosCombustivel(textoParaApi, newCombustivelItens) {
        mostrarLoading(true);
        try {
            // 1. Salva o campo de texto com a lista de itens
            await atualizarCampoUnico(projectId, API_KEYS.COMBUSTIVEL, textoParaApi, projectData.fieldIds);

            // 2. CORREÇÃO: Calcula o novo total de combustível a partir dos itens que acabaram de ser formatados,
            // em vez de usar os dados antigos de `projectData`.
            const novoCustoVenda = newCombustivelItens.find(i => i.finalidade === 'Venda');
            const novoCustoInstalacao = newCombustivelItens.find(i => i.finalidade === 'Instalação');

            const custoVenda = novoCustoVenda ? (novoCustoVenda.distancia * 2 / CONSUMO_FIXO) * novoCustoVenda.valorLitro : 0;
            const custoInstalacao = novoCustoInstalacao ? novoCustoInstalacao.litros * novoCustoInstalacao.valorLitro : 0;
            const totalCombustivel = arredondarParaDuasCasas(custoVenda + custoInstalacao);

            await atualizarCampoUnico(projectId, API_KEYS.TOTAL_COMBUSTIVEL, totalCombustivel.toString(), projectData.fieldIds);

            // 3. Atualiza a UI com os dados mais recentes.
            await refreshDataAndUI();

            // 4. CORREÇÃO: Desbloqueia a interface após a conclusão.
            lockInterface(false);

        } finally {
            mostrarLoading(false);
        }
}
async function removerItemCombustivel(typeToRemove) {
    const { vendaItem, instalacaoItem } = getCombustivelItens();
    const remainingItem = typeToRemove === 'venda' ? instalacaoItem : vendaItem;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const textoParaApi = remainingItem ? 
        (remainingItem.finalidade === 'Venda' ? 
            `${remainingItem.user} | ${remainingItem.date || today} | ${remainingItem.finalidade} | ${remainingItem.descricao} | ${remainingItem.distancia} | ${CONSUMO_FIXO} | ${formatarNumeroParaBR(remainingItem.valorLitro)} | ${formatarNumeroParaBR((remainingItem.distancia * 2 / CONSUMO_FIXO) * remainingItem.valorLitro)}` :
            `${remainingItem.user} | ${remainingItem.date || today} | ${remainingItem.finalidade} | ${remainingItem.descricao} | ${remainingItem.litros} | 0 | ${formatarNumeroParaBR(remainingItem.valorLitro)} | ${formatarNumeroParaBR(remainingItem.litros * remainingItem.valorLitro)}`)
        : '';

    // Passa a lista de itens restantes (que pode ser vazia) para a função de salvar.
    const newCombustivelItens = remainingItem ? [remainingItem] : [];
    await salvarDadosCombustivel(textoParaApi, newCombustivelItens);
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  projectId = params.get('projectId');

  overlay = $('loading-overlay'); // Inicializa a variável do overlay
  mostrarLoading(true);

  if (!projectId) {
    alert('ID do projeto não fornecido.');
    window.location.href = 'index.html';
    return;
  }
  
  // NOVO: Busca os dados do usuário logado
  try {
    const userData = await getMe();
    if (userData.sucesso && userData.user.email) {
      currentUserUsername = userData.user.email.split('@')[0];
      console.log(`[AUTH] Usuário logado: ${currentUserUsername}`);
    } else {
      throw new Error('Token inválido ou expirado.');
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

  // 1. Cria o HTML das abas e seções
  const uiInitialized = initializeEditorUI();

  if (!uiInitialized) {
    console.error("UI não inicializada, abortando carregamento.");
    return; // Interrompe a execução aqui!
  }
  Object.values(KEYS).forEach(key => {
      atualizarTotal(key);
  });
  atualizarTotalCombustivel(); // Garante que o total de combustível também seja calculado.

  const editorContainer = $('editor-container');
  if (editorContainer) {
    editorContainer.classList.remove('oculto');
  }
  
  // Popula o título e o novo subtítulo com os dados do projeto
  $('editor-title').textContent = 'Custos';
  $('editor-subtitle').textContent = `#${projectData.id} - ${projectData.nomeCliente}`;

  // Ativa a primeira aba por padrão
  document.querySelector('.tab-link[data-tab="sec-despesas-projeto"]').classList.add('active'); // Ativa a primeira aba
  document.querySelector('#sec-despesas-projeto').classList.add('active'); // Mostra o conteúdo da primeira aba
}

/**
 * NOVO: Função específica para calcular e atualizar o total da aba de combustível.
 */
function atualizarTotalCombustivel() {
    const { vendaItem, instalacaoItem } = getCombustivelItens();
    const custoVenda = vendaItem ? (vendaItem.distancia * 2 / CONSUMO_FIXO) * vendaItem.valorLitro : 0;
    const custoInstalacao = instalacaoItem ? instalacaoItem.litros * instalacaoItem.valorLitro : 0;
    $('total-combustivel').textContent = formatCurrency(custoVenda + custoInstalacao);
}

document.addEventListener('DOMContentLoaded', init);