const STORAGE_KEY = "mds_inscricoes";
const WHATSAPP_DDD_PAIS = "55";

const listaInscricoes = document.getElementById("listaInscricoes");
const totalInscricoes = document.getElementById("totalInscricoes");
const totalPagas = document.getElementById("totalPagas");
const totalConfirmadas = document.getElementById("totalConfirmadas");
const limparInscricoes = document.getElementById("limparInscricoes");

function buscarInscricoes() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function salvarInscricoes(inscricoes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inscricoes));
}

function limparNumero(numero) {
    return numero.replace(/\D/g, "");
}

function criarLinkWhatsapp(inscricao) {
    const telefone = `${WHATSAPP_DDD_PAIS}${limparNumero(inscricao.whatsapp)}`;
    const texto = `Olá, ${inscricao.nome}! Sua inscrição no curso ${inscricao.curso} foi confirmada com sucesso. Agora podemos marcar a data do seu curso.`;

    return `https://wa.me/${telefone}?text=${encodeURIComponent(texto)}`;
}

function textoStatus(status) {
    if (status === "confirmado") {
        return "Inscrição confirmada";
    }

    if (status === "pago") {
        return "Pagamento recebido";
    }

    return "Aguardando confirmação";
}

function atualizarResumo(inscricoes) {
    totalInscricoes.textContent = inscricoes.length;
    totalPagas.textContent = inscricoes.filter((inscricao) => inscricao.status === "pago" || inscricao.status === "confirmado").length;
    totalConfirmadas.textContent = inscricoes.filter((inscricao) => inscricao.status === "confirmado").length;
}

function renderizarInscricoes() {
    const inscricoes = buscarInscricoes();
    atualizarResumo(inscricoes);

    if (inscricoes.length === 0) {
        listaInscricoes.innerHTML = '<p class="vazio">Nenhuma inscrição recebida ainda.</p>';
        return;
    }

    listaInscricoes.innerHTML = inscricoes.map((inscricao) => {
        const comprovanteHtml = inscricao.comprovante
            ? `<img class="comprovante" src="${inscricao.comprovante}" alt="Comprovante enviado por ${inscricao.nome}">`
            : '<div class="sem-comprovante">Nenhuma imagem de comprovante enviada.</div>';

        return `
            <article class="card-inscricao">
                <div>
                    <span class="status status-${inscricao.status}">${textoStatus(inscricao.status)}</span>
                    <h3>${inscricao.nome}</h3>
                    <p><strong>Curso:</strong> ${inscricao.curso}</p>
                    <p><strong>WhatsApp:</strong> ${inscricao.whatsapp}</p>
                    <p><strong>Recebido em:</strong> ${inscricao.criadaEm}</p>
                    <p><strong>Dúvida/observação:</strong> ${inscricao.duvida || "Nenhuma dúvida enviada."}</p>

                    <div class="acoes-inscricao">
                        <button type="button" class="botao-pago" onclick="alterarStatus(${inscricao.id}, 'pago')">Marcar como pago</button>
                        <button type="button" class="botao-confirmar" onclick="alterarStatus(${inscricao.id}, 'confirmado')">Confirmar inscrição</button>
                        <a class="botao-whatsapp" href="${criarLinkWhatsapp(inscricao)}" target="_blank">Enviar WhatsApp</a>
                    </div>
                </div>
                ${comprovanteHtml}
            </article>
        `;
    }).join("");
}

function alterarStatus(id, status) {
    const inscricoes = buscarInscricoes().map((inscricao) => {
        if (inscricao.id === id) {
            return { ...inscricao, status };
        }

        return inscricao;
    });

    salvarInscricoes(inscricoes);
    renderizarInscricoes();
}

limparInscricoes.addEventListener("click", () => {
    const confirmou = confirm("Deseja apagar todas as inscrições salvas neste navegador?");

    if (confirmou) {
        localStorage.removeItem(STORAGE_KEY);
        renderizarInscricoes();
    }
});

renderizarInscricoes();
