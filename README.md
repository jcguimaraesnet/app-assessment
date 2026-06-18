# Assessment

App para conduzir **arguições orais** (provas orais) com alunos de graduação: apresenta uma sequência de questões cronometradas, uma de cada vez, em uma interface limpa para não dispersar a atenção do aluno.

## 🔗 Acesse o app

### 👉 **https://jcguimaraesnet.github.io/app-assessment**

---

## Como funciona

1. **Setup** — informe o nome do aluno e carregue o conjunto de questões.
2. **Questões** — o app monta o conjunto com as questões **fáceis primeiro** e as **difíceis por último** (o aluno nunca vê essa distinção). Cada questão é revelada sob demanda ("Show question") e tem um cronômetro em anel.
3. **Finish** — ao concluir a última questão, uma animação de fogos + confete encerra a avaliação.

## Recursos

- ⚙️ **Configurações da sessão** (engrenagem): nome da disciplina, quantidade de questões fáceis e difíceis, e tempo por questão.
- 📋 **Banco de questões** (ícone de lista): cole suas questões fáceis e difíceis (uma por linha). Ficam salvas no navegador (`localStorage`).
- ⏱️ Cronômetro por questão com anel de contagem regressiva (default: 1 min).
- 🧭 Navegação sutil entre questões (voltar/avançar reinicia o estado da questão) e botão **Restart**.
- 🎉 Animação de comemoração ao final.
- 🖱️ Toda a interação é por clique — sem atalhos de teclado.

### Valores padrão

| Parâmetro            | Default |
| -------------------- | ------- |
| Questões fáceis      | 6       |
| Questões difíceis    | 2       |
| Tempo por questão    | 60s     |

> Observação: uma questão presente nos dois lotes é tratada como **difícil** (precedência) e sempre vai para o final.

## Desenvolvimento

Requer Node.js e [pnpm](https://pnpm.io/).

```bash
pnpm install      # instala as dependências
pnpm dev          # servidor de desenvolvimento (Vite)
pnpm test         # testes (Vitest)
pnpm build        # build de produção em dist/
pnpm preview      # pré-visualiza o build
```

**Stack:** React 19 + TypeScript + Vite.

## Deploy

O deploy para o **GitHub Pages** é automático: cada `push` na branch `main` dispara o workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), que faz o build e publica o conteúdo de `dist/`.
