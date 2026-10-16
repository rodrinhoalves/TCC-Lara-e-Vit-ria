(function () {
    const form = document.getElementById("formInscricao");
    const mensagem = document.getElementById("mensagemFormulario");
    const botao = document.getElementById("botaoEnviar");
    const campoArquivo = document.getElementById("comprovante");
    const chaveTentativa = "mds_supabase_tentativa_v1";
    const chaveAssinatura = "mds_supabase_assinatura_v1";
    const tipos = {
        "image/jpeg": { extensao: "jpg", bytes: [0xff, 0xd8, 0xff] },
        "image/png": { extensao: "png", bytes: [0x89, 0x50, 0x4e, 0x47] },
        "image/webp": { extensao: "webp", bytes: [0x52, 0x49, 0x46, 0x46] }
    };
    const limiteBytes = 5000000;
    let supabaseClient = null;

    function mostrar(texto, erro) {
        mensagem.textContent = texto;
        mensagem.classList.toggle("mensagem-erro", Boolean(erro));
    }

    function configurarCliente() {
        if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_PUBLIC_KEY ||
            window.SUPABASE_URL.indexOf("COLE_AQUI") !== -1 ||
            window.SUPABASE_PUBLIC_KEY.indexOf("COLE_AQUI") !== -1) {
            mostrar("Conexao ainda nao configurada. Preencha URL e chave publica em supabase-config.js.", true);
            return false;
        }
        supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLIC_KEY);
        return true;
    }

    async function validarComprovante(arquivo) {
        if (!arquivo) return null;
        const tipo = tipos[arquivo.type];
        if (!tipo) throw new Error("Envie somente comprovantes JPG, PNG ou WEBP.");
        if (arquivo.size > limiteBytes) throw new Error("O comprovante deve ter no maximo 5 MB.");
        const inicio = new Uint8Array(await arquivo.slice(0, 12).arrayBuffer());
        const assinaturaCorreta = tipo.bytes.every(function (byte, indice) {
            return inicio[indice] === byte;
        });
        if (!assinaturaCorreta || (arquivo.type === "image/webp" &&
            String.fromCharCode.apply(null, Array.from(inicio.slice(8, 12))) !== "WEBP")) {
            throw new Error("O conteudo do arquivo nao corresponde a um JPG, PNG ou WEBP valido.");
        }
        return tipo;
    }

    async function assinaturaEnvio(dados, arquivo) {
        const arquivoInfo = arquivo ? {
            nome: arquivo.name,
            tamanho: arquivo.size,
            alterado: arquivo.lastModified,
            sha256: Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await arquivo.arrayBuffer())))
                .map(function (b) { return b.toString(16).padStart(2, "0"); }).join("")
        } : null;
        const bytes = new TextEncoder().encode(JSON.stringify({ dados: dados, arquivo: arquivoInfo }));
        const hash = await crypto.subtle.digest("SHA-256", bytes);
        return Array.from(new Uint8Array(hash)).map(function (b) {
            return b.toString(16).padStart(2, "0");
        }).join("");
    }

    function dadosFormulario() {
        return {
            nome: document.getElementById("nome").value.trim(),
            whatsapp: document.getElementById("whatsapp").value.trim(),
            curso: document.getElementById("curso").value,
            duvida: document.getElementById("duvida").value.trim()
        };
    }

    function erroDeDuplicidade(erro) {
        return erro && (String(erro.statusCode) === "409" ||
            /already exists|duplicate/i.test(erro.message || ""));
    }

    form.addEventListener("submit", async function (evento) {
        evento.preventDefault();
        mostrar("", false);
        if (!form.reportValidity()) return;
        if (!configurarCliente()) return;

        const arquivo = campoArquivo.files[0] || null;
        let dados;
        let assinatura;
        let tentativa;

        botao.disabled = true;
        botao.textContent = "Validando...";
        try {
            const tipo = await validarComprovante(arquivo);
            dados = dadosFormulario();
            assinatura = await assinaturaEnvio(dados, arquivo);
            tentativa = localStorage.getItem(chaveTentativa);
            const assinaturaPendente = localStorage.getItem(chaveAssinatura);

            if (tentativa && assinaturaPendente && assinaturaPendente !== assinatura) {
                throw new Error("Ha uma tentativa anterior sem confirmacao. Para evitar duplicidade, restaure os mesmos campos e selecione o mesmo arquivo antes de tentar novamente.");
            }
            if (!tentativa) {
                tentativa = crypto.randomUUID();
                localStorage.setItem(chaveAssinatura, assinatura);
                localStorage.setItem(chaveTentativa, tentativa);
            }

            botao.textContent = "Enviando...";
            if (arquivo && tipo) {
                const caminho = tentativa + "/comprovante." + tipo.extensao;
                const { error: erroUpload } = await supabaseClient.storage
                    .from("comprovantes")
                    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
                if (erroUpload && !erroDeDuplicidade(erroUpload)) throw erroUpload;
            }

            const caminhoComprovante = arquivo && tipo
                ? tentativa + "/comprovante." + tipo.extensao
                : null;
            const { error: erroBanco } = await supabaseClient.rpc("enviar_inscricao", {
                p_id: tentativa,
                p_nome: dados.nome,
                p_whatsapp: dados.whatsapp,
                p_curso: dados.curso,
                p_duvida: dados.duvida,
                p_comprovante_path: caminhoComprovante
            });
            if (erroBanco) throw erroBanco;

            try {
                localStorage.removeItem(chaveTentativa);
                localStorage.removeItem(chaveAssinatura);
            } catch (erroLimpeza) {
                console.warn("A inscricao foi gravada, mas nao foi possivel limpar a chave temporaria da sessao.");
            }
            form.reset();
            mostrar("Inscricao enviada com sucesso!", false);
        } catch (erro) {
            console.error("Falha ao enviar inscricao:", erro && erro.code ? erro.code : erro);
            mostrar(erro && erro.message && erro.message.indexOf("Ha uma tentativa anterior") === 0
                ? erro.message
                : (erro && erro.message && erro.message.indexOf("Envie somente") === 0) ||
                    (erro && erro.message && erro.message.indexOf("O comprovante") === 0) ||
                    (erro && erro.message && erro.message.indexOf("O conteudo") === 0)
                    ? erro.message
                    : "Nao foi possivel confirmar o envio. Seus dados continuam no formulario; verifique a conexao e tente novamente.", true);
        } finally {
            botao.disabled = false;
            botao.textContent = "Enviar inscricao";
        }
    });
})();
