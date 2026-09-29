const STORAGE_KEY = "mds_inscricoes";

const form = document.getElementById("formInscricao");
const mensagemFormulario = document.getElementById("mensagemFormulario");

function buscarInscricoes() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function salvarInscricoes(inscricoes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inscricoes));
}

function lerImagemComoTexto(arquivo) {
    return new Promise((resolve) => {
        if (!arquivo) {
            resolve("");
            return;
        }

        const leitor = new FileReader();
        leitor.onload = () => resolve(leitor.result);
        leitor.readAsDataURL(arquivo);
    });
}

form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const comprovante = document.getElementById("comprovante").files[0];
    const imagemComprovante = await lerImagemComoTexto(comprovante);

    const novaInscricao = {
        id: Date.now(),
        nome: document.getElementById("nome").value.trim(),
        whatsapp: document.getElementById("whatsapp").value.trim(),
        curso: document.getElementById("curso").value,
        duvida: document.getElementById("duvida").value.trim(),
        comprovante: imagemComprovante,
        status: "aguardando",
        criadaEm: new Date().toLocaleString("pt-BR")
    };

    const inscricoes = buscarInscricoes();
    inscricoes.unshift(novaInscricao);
    salvarInscricoes(inscricoes);

    form.reset();
    mensagemFormulario.textContent = "Inscrição enviada com sucesso!";
});
