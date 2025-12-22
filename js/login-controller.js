import { createUser, login } from './api.js';

/**
 * Atalho para document.getElementById.
 * @param {string} id O ID do elemento a ser encontrado.
 * @returns {HTMLElement | null}
 */
const $ = (id) => document.getElementById(id);

// --- Seletores do DOM ---
const loginView = $('login-view');
const registerView = $('register-view');
const verifyLinkView = $('verify-link-view');
const loginForm = $('login-form');
const registerForm = $('register-form');
const showRegisterLink = $('show-register');
const showLoginLink = $('show-login');

/**
 * Alterna a visibilidade entre as telas de login e registro.
 * @param {boolean} showRegister - Se true, exibe a tela de registro; senão, exibe a de login.
 */
function toggleViews(showRegister = false) {
  loginView.classList.toggle('oculto', showRegister);
  registerView.classList.toggle('oculto', !showRegister);
}

/**
 * Exibe a seção com o link de verificação de e-mail.
 * @param {object} data - O objeto de resposta da API, contendo o `verifyLink`.
 */
function redirectToVerification(data) {
  if (data && data.verifyLink) {
    alert('Conta criada com sucesso! Você será redirecionado para verificar seu e-mail.');
    // Redireciona o navegador para a URL de verificação.
    window.location.href = data.verifyLink;
  }
}

/**
 * Wrapper para chamadas de API que centraliza o tratamento de erros.
 * @param {Function} apiFunction - A função da API a ser chamada.
 * @param {Function} onSuccess - Callback a ser executado em caso de sucesso.
 * @param  {...any} args - Argumentos a serem passados para a função da API.
 */
async function handleApiCall(apiFunction, onSuccess, ...args) {
  try {
    const data = await apiFunction(...args);
    if (data.erro) throw new Error(data.erro);
    if (onSuccess) onSuccess(data);
  } catch (err) {
    console.error(`[AUTH] Falha na chamada para '${apiFunction.name}'. Erro: ${err.message}`, { args });
    alert(`Erro: ${err.message}`);
  }
}

/**
 * Configura a funcionalidade de mostrar/ocultar senha para um campo.
 * @param {string} inputId - O ID do campo de senha.
 * @param {string} toggleId - O ID do ícone de toggle.
 */
function setupPasswordToggle(inputId, toggleId) {
  const passwordInput = $(inputId);
  const toggleIcon = $(toggleId);

  if (passwordInput && toggleIcon) {
    toggleIcon.addEventListener('click', () => {
      // Alterna o tipo do input
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';

      // Se o campo se tornou texto (senha visível), o ícone deve ser 'fa-eye' (aberto).
      // Se o campo se tornou senha (senha oculta), o ícone deve ser 'fa-eye-slash' (cortado).
      toggleIcon.classList.toggle('fa-eye', isPassword);
      toggleIcon.classList.toggle('fa-eye-slash', !isPassword);
      toggleIcon.title = isPassword ? 'Ocultar senha' : 'Mostrar senha';
    });
  }
}

// --- Event Listeners ---

/**
 * Inicializa todos os event listeners da página de login/registro.
 */
function init() {
  // Limpa qualquer sessão existente ao carregar a tela de login para garantir um estado limpo
  localStorage.removeItem('authToken');
  localStorage.removeItem('username');
  sessionStorage.clear();

  // Verifica se a URL contém o parâmetro de verificação bem-sucedida
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('verified') === 'true') {
    alert('Sua conta foi verificada com sucesso! Por favor, faça o login.');
    // Limpa a URL para que a mensagem não apareça novamente ao recarregar a página
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (urlParams.get('error') === 'invalid_token') {
    alert('O link de verificação é inválido ou expirou. Por favor, tente se cadastrar novamente.');
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (urlParams.get('error') === 'user_not_found') {
    alert('O usuário para verificação não foi encontrado. O link pode ter sido usado ou expirado.');
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Adiciona listeners para a funcionalidade de registro apenas se os elementos existirem
  if (showRegisterLink && showLoginLink && registerForm) {
    showRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      toggleViews(true);
    });

    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      toggleViews(false);
    });

    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = $('register-email').value;
      const password = $('register-password').value;
      if (!email || !password) return;
      if (password.length < 8) {
        return alert('A senha deve ter no mínimo 8 caracteres.');
      }
      handleApiCall(createUser, redirectToVerification, email, password);
    });
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('login-email').value;
    const password = $('login-password').value;
    handleApiCall(login, (data) => {
      // O token e o usuário já foram salvos corretamente pelo api.js
      window.location.href = 'projeto.html'; // Redireciona para a página de projetos
    }, email, password);
  });

  // Inicializa a funcionalidade de mostrar/ocultar senha
  setupPasswordToggle('login-password', 'toggle-login-password');
  setupPasswordToggle('register-password', 'toggle-register-password');
}

// Inicia a aplicação
init();