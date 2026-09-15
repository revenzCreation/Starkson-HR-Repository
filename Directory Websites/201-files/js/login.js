const form = document.getElementById('loginForm');
const status = document.getElementById('loginStatus');

if (window.location.pathname.toLowerCase().endsWith('/login.html') || window.location.pathname.toLowerCase().endsWith('/login')) {
  window.location.replace('index.html');
  return;
}

if (form) {
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (status) {
      status.textContent = 'Opening the directory...';
    }
    window.location.replace('index.html');
  });
}
