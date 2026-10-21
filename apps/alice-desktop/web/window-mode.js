document.documentElement.classList.toggle('pet-mode',new URLSearchParams(location.search).get('mode')==='pet');
