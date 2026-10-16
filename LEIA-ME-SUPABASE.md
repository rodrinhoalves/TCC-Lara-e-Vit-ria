# Supabase para o TCC

Este guia prepara uma integracao para projeto novo, usando HTML, CSS e JavaScript sem trocar o framework. O projeto ainda precisa ser testado com uma instancia Supabase real antes de ser considerado pronto.

## 1. Criar um projeto novo

1. Entre em [supabase.com](https://supabase.com/) e crie uma conta ou entre na sua conta.
2. Crie uma organizacao se o painel pedir e escolha **New project**.
3. Dê um nome ao projeto, crie uma senha forte para o banco e guarde-a em um gerenciador de senhas. A senha do banco nunca vai para o navegador nem para `supabase-config.js`.
4. Escolha a regiao mais proxima e crie o projeto. Aguarde o banco terminar de iniciar.
5. No painel do projeto, abra **Project Settings > API Keys** (em algumas versoes, **Settings > API**) e copie a **Project URL** e a chave **publishable** (ou a chave publica `anon` legada). Nao use `secret`, `service_role`, nem a senha do banco.

## 2. Criar as tabelas e as regras

1. No painel, abra **SQL Editor > New query**.
2. Abra `schema.sql` desta pasta, copie todo o conteudo, cole no editor e escolha **Run**.
3. Confira se o editor terminou sem erro. O script cria a tabela `public.inscricoes`, as funcoes usadas pelo formulario e pela verificacao de administradora, e o bucket privado `comprovantes`.
4. O bucket limita cada arquivo a 5 MB (5.000.000 bytes) e aceita os MIME `image/jpeg`, `image/png` e `image/webp`. O visitante pode enviar arquivos, mas as politicas nao permitem que visitante leia, liste ou apague arquivos. O bucket permanece privado; links assinados so sao emitidos pelo painel autenticado.
5. Abra **Storage > Settings** e defina **Global file size limit** como 5 MB. O SQL tambem define 5.000.000 bytes no bucket; os dois limites ficam alinhados. A cota total de armazenamento continua sendo a cota do plano/projeto, entao acompanhe o uso em **Storage** e no painel de uso.
6. Em **Project Settings > API > Exposed schemas**, confirme que `private` nao esta na lista. Ela contem a tabela de autorizacao da administradora.

> Rode este SQL apenas uma vez em um projeto novo. Ele cria ou atualiza o bucket e as politicas com nomes especificos, mas nao e uma ferramenta de migracao para um banco ja existente.

## 3. Configurar a conexao no site

1. Abra `supabase-config.js` nesta pasta.
2. Substitua `COLE_AQUI_A_URL_DO_SEU_PROJETO` pela Project URL e `COLE_AQUI_A_CHAVE_PUBLICA_DO_SEU_PROJETO` pela chave publishable/anon que acabou de copiar.
3. Salve o arquivo. Esses valores sao publicos por definicao e podem estar no navegador. Nunca cole senha do banco, chave `secret` ou `service_role`.
4. Abra o site por um servidor HTTP local, como Live Server no VS Code. Abrir diretamente por `file://` pode bloquear requisicoes do navegador ou causar problemas de autenticacao.

## 4. Autorizar a administradora

O site nao tem cadastro nem botao de promover usuario. A conta deve ser criada pelo responsavel do projeto no painel e autorizada separadamente.

1. No Supabase, abra **Authentication > Users > Add user** (ou **Invite user**) e crie a conta da administradora com o e-mail dela. Se criar uma senha temporaria, entregue-a por canal seguro e altere-a no primeiro acesso.
2. Copie o UUID dessa conta na lista de usuarios.
3. Volte ao **SQL Editor** e execute, trocando o UUID pelo da conta criada:

```sql
insert into private.admin_users (user_id)
values ('COLE-O-UUID-DA-CONTA-AQUI');
```

Somente quem tem acesso administrativo ao painel/SQL do projeto consegue gravar essa autorizacao. `raw_user_meta_data`, formulario publico e chave publica nao autorizam ninguem. Para retirar o acesso, execute `delete from private.admin_users where user_id = 'UUID';`.

## 5. Testar por etapas

### Testes locais (sem Supabase real)

- Verifique que as paginas carregam, que a validacao de campos e do formato/tamanho do comprovante funciona e que os erros mantem o formulario preenchido.
- Confirme que `supabase-config.js` continua com placeholders e que a pagina informa que a conexao nao foi configurada.
- Esses testes nao demonstram que as regras RLS, Auth, Storage, nem as cotas reais estao corretas.

### Testes com o Supabase real

Use primeiro dados ficticios, sem comprovantes ou dados pessoais reais de clientes.

1. Envie uma inscricao sem comprovante e depois outra com JPG, PNG e WEBP menores que 5 MiB.
2. Tente um GIF e um arquivo acima de 5 MiB: o formulario deve recusar ambos; confirme que o Storage tambem recusa upload fora das regras.
3. Com uma janela anonima/desconectada, tente consultar `inscricoes`, listar/baixar comprovantes ou alterar status usando a chave publica. Tudo deve ser negado ou retornar zero linhas sem expor dados.
4. Entre no painel com conta comum do Auth ainda nao autorizada. O login nao deve abrir os dados.
5. Entre com a conta explicitamente autorizada. Confirme leitura dos dados, link assinado temporario do comprovante, alteracao de status, atualizacao do painel e logout.
6. Na aba Network do navegador, desligue/religue a rede durante uma tentativa. Confirme que nao ha mensagem de sucesso parcial, que o formulario fica preenchido e que tentar novamente nao cria uma duplicata.
7. No SQL Editor, confira a tabela e os status. Verifique tambem em Storage que os objetos estao no bucket privado `comprovantes`.

Somente depois desses testes com o projeto real podemos confirmar envio, leitura, comprovantes, login e permissoes. A ausencia de erros em testes locais nao comprova a configuracao de seguranca do projeto Supabase.

## Falhas e tentativas repetidas

Cada envio usa um UUID e uma assinatura da tentativa, guardados em duas chaves novas e separadas do `mds_inscricoes` no `localStorage` ate haver sucesso. A assinatura nao armazena os dados do formulario em texto simples. A funcao SQL fixa o status inicial como `aguardando` e usa esse UUID para que uma repeticao com os mesmos dados nao crie outra linha. Se a pessoa editar os dados enquanto ainda houver uma tentativa incerta, a pagina pede que restaure os mesmos dados e arquivo antes de tentar de novo. O upload e a gravacao do banco sao duas operacoes distintas: se o arquivo subir e a gravacao falhar, a pagina nao anuncia sucesso; a nova tentativa reutiliza o caminho e completa a mesma inscricao. Se a pessoa abandonar definitivamente essa tentativa, o arquivo pode ficar orfao no bucket; a administradora deve revisar e remover esses arquivos pela tela **Storage** do painel. A aplicacao nao apaga automaticamente comprovantes em falha porque visitantes nao recebem permissao para excluir arquivos.

## Inscricoes antigas e botao do painel

Os registros antigos em `localStorage` nao sao apagados nem importados automaticamente para o banco. Eles permanecem no navegador original. A importacao futura deve ser uma etapa manual separada, apos conferir os dados, e deve manter todos os status antigos como aguardando ate verificacao humana.

O antigo botao **Limpar painel** foi substituido por **Atualizar painel**. Ele somente busca os registros atuais de novo; nao apaga o banco nem os dados locais.
