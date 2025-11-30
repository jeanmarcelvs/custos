// js/login-controller.js

document.getElementById('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('login-project').value;
  if (!id) {
    return alert('Informe o ID do projeto.');
  }
  // redireciona para página do projeto
  window.location.href = `projeto.html?projectId=${encodeURIComponent(id)}`;
});