(function () {
    const loginArea = document.getElementById("loginAdmin");
    const conteudoAdmin = document.getElementById("conteudoAdmin");
    const formLogin = document.getElementById("formLoginAdmin");
    const mensagemLogin = document.getElementById("mensagemLoginAdmin");
    const botaoLogin = document.getElementById("botaoLoginAdmin");
    const identidade = document.getElementById("identidadeAdmin");
    const lista = document.getElementById("listaInscricoes");
    const totalInscricoes = document.getElementById("totalInscricoes");
    const totalPagas = document.getElementById("totalPagas");
    const totalConfirmadas = document.getElementById("totalConfirmadas");
    const botaoSair = document.getElementById("sairAdmin");
    const botaoAtualizar = document.getElementById("limparBusca");
    const dddPais = "55";
    let client = null;
    let sessaoAtualizada = false;

    function mensagem(texto, erro) {
        mensagemLogin.textContent = texto;
        mensagemLogin.classList.toggle("mensagem-erro", Boolean(erro));
    }

    function estadoLogado(email) {
        loginArea.hidden = true;
        conteudoAdmin.hidden = false;
        identidade.textContent = "Conectada: " + (email || "administradora");
    }

    function estadoDeslogado() {
        loginArea.hidden = false;
        conteudoAdmin.hidden = true;
        lista.replaceChildren();
        identidade.textContent = "";
    }

    function criarElemento(tag, texto, classe) {
        const elemento = document.createElement(tag);
        if (texto !== undefined && texto !== null) elemento.textContent = String(texto);
        if (classe) elemento.className = classe;
        return elemento;
    }

    function linkWhatsapp(inscricao) {
        const telefone = dddPais + String(inscricao.whatsapp || "").replace(/\D/g, "");
        const texto = "Ola, " + inscricao.nome + "! Sua inscricao no curso " + inscricao.curso +
            " foi confirmada com sucesso. Agora podemos marcar a data do seu curso.";
        return "https://wa.me/" + telefone + "?text=" + encodeURIComponent(texto);
    }

    function rotuloStatus(status) {
        if (status === "confirmado") return "Inscricao confirmada";
        if (status === "pago") return "Pagamento recebido";
        return "Aguardando confirmacao";
    }

    async function atualizarStatus(id, status, botao) {
        botao.disabled = true;
        try {
            const { data, error } = await client.from("inscricoes")
                .update({ status: status }).eq("id", id).select("id").maybeSingle();
            if (error) throw error;
            if (!data) throw new Error("A alteracao nao foi autorizada.");
            await carregarInscricoes();
        } catch (erro) {
            console.error("Falha ao atualizar status:", erro && erro.code ? erro.code : erro);
            alert("Nao foi possivel atualizar o status. Verifique sua autorizacao e a conexao.");
            botao.disabled = false;
        }
    }

    async function criarCartao(inscricao) {
        const cartao = criarElemento("article", null, "card-inscricao");
        const conteudo = document.createElement("div");
        const status = criarElemento("span", rotuloStatus(inscricao.status), "status status-" + inscricao.status);
        conteudo.appendChild(status);
        conteudo.appendChild(criarElemento("h3", inscricao.nome));
        const campos = [
            ["Curso:", inscricao.curso],
            ["WhatsApp:", inscricao.whatsapp],
            ["Recebido em:", new Date(inscricao.criada_em).toLocaleString("pt-BR")],
            ["Duvida/observacao:", inscricao.duvida || "Nenhuma duvida enviada."]
        ];
        campos.forEach(function (campo) {
            const paragrafo = document.createElement("p");
            paragrafo.appendChild(criarElemento("strong", campo[0]));
            paragrafo.appendChild(document.createTextNode(" " + campo[1]));
            conteudo.appendChild(paragrafo);
        });

        const acoes = criarElemento("div", null, "acoes-inscricao");
        const marcarPago = criarElemento("button", "Marcar como pago", "botao-pago");
        marcarPago.type = "button";
        marcarPago.addEventListener("click", function () { atualizarStatus(inscricao.id, "pago", marcarPago); });
        const confirmar = criarElemento("button", "Confirmar inscricao", "botao-confirmar");
        confirmar.type = "button";
        confirmar.addEventListener("click", function () { atualizarStatus(inscricao.id, "confirmado", confirmar); });
        const whatsapp = criarElemento("a", "Enviar WhatsApp", "botao-whatsapp");
        whatsapp.href = linkWhatsapp(inscricao);
        whatsapp.target = "_blank";
        whatsapp.rel = "noopener noreferrer";
        acoes.append(marcarPago, confirmar, whatsapp);
        conteudo.appendChild(acoes);
        cartao.appendChild(conteudo);

        if (inscricao.comprovante_path) {
            const { data, error } = await client.storage.from("comprovantes")
                .createSignedUrl(inscricao.comprovante_path, 60);
            if (!error && data && data.signedUrl) {
                const imagem = document.createElement("img");
                imagem.className = "comprovante";
                imagem.src = data.signedUrl;
                imagem.alt = "Comprovante enviado por " + inscricao.nome;
                cartao.appendChild(imagem);
            } else {
                cartao.appendChild(criarElemento("div", "Nao foi possivel abrir o comprovante.", "sem-comprovante"));
            }
        } else {
            cartao.appendChild(criarElemento("div", "Nenhuma imagem de comprovante enviada.", "sem-comprovante"));
        }
        return cartao;
    }

    async function carregarInscricoes() {
        lista.replaceChildren(criarElemento("p", "Carregando inscricoes...", "vazio"));
        const { data, error } = await client.from("inscricoes")
            .select("id,nome,whatsapp,curso,duvida,comprovante_path,status,criada_em")
            .order("criada_em", { ascending: false });
        if (error) throw error;

        const inscricoes = data || [];
        totalInscricoes.textContent = inscricoes.length;
        totalPagas.textContent = inscricoes.filter(function (item) {
            return item.status === "pago" || item.status === "confirmado";
        }).length;
        totalConfirmadas.textContent = inscricoes.filter(function (item) {
            return item.status === "confirmado";
        }).length;

        if (!inscricoes.length) {
            lista.replaceChildren(criarElemento("p", "Nenhuma inscricao recebida ainda.", "vazio"));
            return;
        }
        const cartoes = await Promise.all(inscricoes.map(criarCartao));
        lista.replaceChildren.apply(lista, cartoes);
    }

    async function verificarSessao(sessao) {
        if (!sessao || !sessao.user) {
            estadoDeslogado();
            mensagem("", false);
            return;
        }
        const { data, error } = await client.rpc("sou_administradora");
        if (error || data !== true) {
            await client.auth.signOut();
            estadoDeslogado();
            mensagem("Esta conta nao esta autorizada como administradora.", true);
            return;
        }
        estadoLogado(sessao.user.email);
        try {
            await carregarInscricoes();
        } catch (erro) {
            console.error("Falha ao carregar painel:", erro && erro.code ? erro.code : erro);
            lista.replaceChildren(criarElemento("p", "Nao foi possivel carregar os dados. Verifique a conexao.", "vazio"));
        }
    }

    if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_PUBLIC_KEY ||
        window.SUPABASE_URL.indexOf("COLE_AQUI") !== -1 ||
        window.SUPABASE_PUBLIC_KEY.indexOf("COLE_AQUI") !== -1) {
        mensagem("Conexao ainda nao configurada. Preencha URL e chave publica em supabase-config.js.", true);
        formLogin.querySelectorAll("input,button").forEach(function (campo) { campo.disabled = true; });
        return;
    }
    client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLIC_KEY);

    formLogin.addEventListener("submit", async function (evento) {
        evento.preventDefault();
        botaoLogin.disabled = true;
        mensagem("Entrando...", false);
        try {
            const { data, error } = await client.auth.signInWithPassword({
                email: document.getElementById("emailAdmin").value.trim(),
                password: document.getElementById("senhaAdmin").value
            });
            if (error) throw error;
            sessaoAtualizada = true;
            await verificarSessao(data.session);
        } catch (erro) {
            console.error("Falha no login:", erro && erro.code ? erro.code : erro);
            mensagem("Nao foi possivel entrar. Confira o e-mail, a senha e a conexao.", true);
        } finally {
            botaoLogin.disabled = false;
        }
    });

    botaoSair.addEventListener("click", async function () {
        await client.auth.signOut();
        estadoDeslogado();
        mensagem("Sessao encerrada.", false);
    });
    botaoAtualizar.addEventListener("click", async function () {
        try {
            await carregarInscricoes();
        } catch (erro) {
            lista.replaceChildren(criarElemento("p", "Nao foi possivel atualizar. Verifique a conexao.", "vazio"));
        }
    });

    client.auth.getSession().then(function (resultado) {
        verificarSessao(resultado.data.session);
    }).catch(function () {
        estadoDeslogado();
        mensagem("Nao foi possivel verificar a sessao. Atualize a pagina.", true);
    });
    client.auth.onAuthStateChange(function (evento, sessao) {
        if (evento === "SIGNED_OUT") {
            estadoDeslogado();
            return;
        }
        if ((evento === "SIGNED_IN" || evento === "TOKEN_REFRESHED") && !sessaoAtualizada) {
            sessaoAtualizada = true;
            window.setTimeout(function () { verificarSessao(sessao); }, 0);
        }
    });
})();
