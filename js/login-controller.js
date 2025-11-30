// js/login-controller.js

import { createUser, login } from './api.js';

const $ = (id) => document.getElementById(id);

const loginView = $('login-view');
const registerView = $('register-view');
const verifyLinkView = $('verify-link-view');

const loginForm = $('login-form');
const registerForm = $('register-form');

const showRegisterLink = $('show-register');
const showLoginLink = $('show-login');

// --- Funções de UI ---
function toggleViews(showRegister = false) {
  loginView.classList.toggle('oculto', showRegister);
  registerView.classList.toggle('oculto', !showRegister);
}

function showVerificationLink(link) {
  registerForm.classList.add('oculto');
  verifyLinkView.classList.remove('oculto');
  $('verify-link').href = link;
}

async function handleApiCall(apiFunction, onSuccess, ...args) {
  try {
    const data = await apiFunction(...args);
    if (data.erro) throw new Error(data.erro); // Lança o erro para o bloco catch
    if (onSuccess) onSuccess(data);
  } catch (err) {
    console.error(`[API Call Failed] Falha na chamada para '${apiFunction.name}'. Erro: ${err.message}`, { args });
    alert(`Erro: ${err.message}`); // Mostra um alerta amigável para o usuário
    // Não relançamos o erro, permitindo que a aplicação continue.
  }
}

// --- Event Listeners ---

showRegisterLink.addEventListener('click', (e) => {
  e.preventDefault();
  toggleViews(true);
  // Garante que o formulário de registro esteja visível e a tela de link oculta
  registerForm.classList.remove('oculto');
  verifyLinkView.classList.add('oculto');
});

showLoginLink.addEventListener('click', (e) => {
  e.preventDefault();
  toggleViews(false);
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('register-email').value;
  const password = $('register-password').value;
  if (!email || !password) return;
  if (password.length < 8) {
    return alert('A senha deve ter no mínimo 8 caracteres.');
  }

  console.log(`[AUTH LOG] Iniciando criação de conta para o e-mail: ${email}.`);
  handleApiCall(createUser, (data) => {
    console.log(`[AUTH LOG] Conta criada. Exibindo link de verificação.`);
    showVerificationLink(data.verifyLink);
  }, email, password);
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('login-email').value;
  const password = $('login-password').value;
  console.log(`[AUTH LOG] Tentativa de login para o e-mail: ${email}.`);
  handleApiCall(login, (data) => {
    localStorage.setItem('authToken', data.token);
    console.log(`[AUTH LOG] Login bem-sucedido. Redirecionando para a página de projetos.`);
    window.location.href = 'projeto.html';
  }, email, password);
});