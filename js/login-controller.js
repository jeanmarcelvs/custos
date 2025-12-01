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
 * @param {string} link - A URL de verificação a ser exibida.
 */
function showVerificationLink(link) {
  registerForm.classList.add('oculto');
  verifyLinkView.classList.remove('oculto');
  $('verify-link').href = link;
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

// --- Event Listeners ---

/**
 * Inicializa todos os event listeners da página de login/registro.
 */
function init() {
  showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    toggleViews(true);
    registerForm.classList.remove('oculto');
    verifyLinkView.classList.add('oculto');
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
    handleApiCall(createUser, showVerificationLink, email, password);
  });

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('login-email').value;
    const password = $('login-password').value;
    handleApiCall(login, (data) => {
      localStorage.setItem('authToken', data.token);
      window.location.href = 'projeto.html';
    }, email, password);
  });
}

// Inicia a aplicação
init();