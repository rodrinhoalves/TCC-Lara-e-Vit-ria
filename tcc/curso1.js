// Seleciona os elementos
const imagens = document.querySelectorAll(".carousel-container img");
const btnEsquerda = document.querySelector(".seta-esquerda");
const btnDireita = document.querySelector(".seta-direita");

let imagemAtual = 0;

// Função para mostrar apenas a imagem atual
function mostrarImagem(index) {
    imagens.forEach((img, i) => {
        img.style.display = i === index ? "block" : "none";
    });
}

// Próxima imagem
btnDireita.addEventListener("click", () => {
    imagemAtual++;

    if (imagemAtual >= imagens.length) {
        imagemAtual = 0;
    }

    mostrarImagem(imagemAtual);
});

// Imagem anterior
btnEsquerda.addEventListener("click", () => {
    imagemAtual--;

    if (imagemAtual < 0) {
        imagemAtual = imagens.length - 1;
    }

    mostrarImagem(imagemAtual);
});

// Inicia mostrando apenas a primeira
mostrarImagem(imagemAtual);