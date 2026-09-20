# FORJA com Google Planilhas

Hoje o app roda em **modo local**: contas e dados ficam só no navegador (localStorage).
Tudo já está pronto para trocar para o Google Planilhas em uns 10 minutos, sem mudar código do app.

## Como funciona

```
App (navegador)                      Google
┌─────────────────────┐   HTTPS    ┌──────────────────────┐     ┌─────────────────┐
│ localStorage (cache)│ ─────────► │ Apps Script (Code.gs)│ ──► │ Planilha        │
│ js/backend.js       │  POST JSON │ = seu "servidor"     │     │ usuarios        │
└─────────────────────┘            └──────────────────────┘     │ sessoes         │
                                                                 │ dados           │
                                                                 └─────────────────┘
```

- O app continua lendo e gravando no localStorage (rápido e funciona offline).
- Toda alteração é enviada para a planilha ~2,5 s depois. Sem internet, ela fica na fila e sobe quando a conexão voltar.
- Ao entrar em outro aparelho, o app baixa os dados da conta da planilha.
- As senhas nunca são gravadas: a planilha guarda só o *hash* (SHA-256 com salt único por usuário).

## Passo a passo

1. **Crie a planilha.** Em [sheets.new](https://sheets.new), dê o nome `FORJA - Banco de dados`.
2. **Abra o Apps Script.** Menu *Extensões › Apps Script*. Apague o conteúdo de `Código.gs` e cole todo o arquivo `backend/apps-script/Code.gs`. Salve.
3. **Crie as abas.** No editor, escolha a função `setup` na barra de cima e clique em *Executar*. Autorize o acesso quando o Google pedir. A planilha ganha as abas `usuarios`, `sessoes` e `dados`.
4. **Publique.** *Implantar › Nova implantação*. Tipo: **App da Web**. Executar como: **Eu**. Quem pode acessar: **Qualquer pessoa**. Clique em *Implantar* e copie a URL que termina em `/exec`.
5. **Ligue no app.** Em `js/config.js`:
   ```js
   backend: 'sheets',
   sheetsUrl: 'https://script.google.com/macros/s/SEU_ID/exec',
   ```
6. **Teste.** Abra a URL `/exec` no navegador: deve aparecer `{"ok":true,"app":"FORJA","status":"online"}`. Depois crie uma conta no app e veja a linha nova na aba `usuarios`.

> Mudou o Code.gs depois? Publique de novo em *Implantar › Gerenciar implantações › Editar › Nova versão*. A URL continua a mesma.

## Plano Free e Premium

- O plano fica na coluna `plano` da aba `usuarios` (`free` ou `premium`). Dá para mudar à mão na planilha, e o app lê o valor novo ao abrir.
- **Pagamento ainda é simulado.** Enquanto a propriedade do script `ALLOW_PLAN_CHANGE` for `true` (o `setup` já deixa assim), o próprio app consegue virar Premium pela tela de planos.
- Quando entrar o pagamento de verdade (Mercado Pago, Stripe…), mude `ALLOW_PLAN_CHANGE` para `false` em *Configurações do projeto › Propriedades do script*, e deixe só o webhook do pagamento alterar o plano.

## Limites bons de saber

- O Google Planilhas funciona bem para começar (centenas de usuários ativos). Cada chamada leva de 0,5 a 2 s, por isso o app sincroniza em segundo plano e nunca espera a planilha para mostrar nada.
- O Apps Script tem cotas diárias (cerca de 20 mil chamadas por dia na conta gratuita). Com milhares de usuários, o caminho natural é migrar para Supabase ou Firebase. O app não muda: basta escrever um adaptador novo em `js/backend.js` com as mesmas funções (`register`, `login`, `me`, `setPlan`, `pull`, `push`, `clear`).
- Opcional: crie um acionador diário para a função `cleanupSessions`, que apaga sessões vencidas.

## Formato dos dados

| Aba | Colunas |
|---|---|
| `usuarios` | id, email, nome, hash, salt, plano, criadoEm, planoAtualizadoEm |
| `sessoes` | token, userId, criadoEm, expiraEm (60 dias) |
| `dados` | userId, chave, parte, json, atualizadoEm |

Na aba `dados`, cada chave do app (`workouts`, `sessions`, `bodyweight`, `profile`…) é um JSON. Textos com mais de 45 mil caracteres são divididos em várias linhas (`parte` 0, 1, 2…), porque uma célula aceita no máximo 50 mil.
