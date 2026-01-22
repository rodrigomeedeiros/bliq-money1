
# 🚀 BLIQ MONEY - Guia Profissional de Deploy

Siga estes passos para colocar seu app financeiro no iPhone 13 via GitHub e Vercel.

---

### 1️⃣ Passo: Criar o Repositório no GitHub
1. Acesse seu [GitHub](https://github.com/).
2. No canto superior direito, clique no **+** e selecione **"New repository"**.
3. Em **Repository name**, digite `bliq-money`.
4. Deixe como **Public** ou **Private** (sua escolha).
5. Clique em **"Create repository"**.

### 2️⃣ Passo: Subir os Arquivos (Pelo Navegador)
1. Na tela que apareceu, clique no link **"uploading an existing file"**.
2. **Arraste todos os arquivos** que geramos aqui (index.html, App.tsx, package.json, etc.) para dentro da área de upload.
3. Espere todos os arquivos carregarem (a barra azul deve completar).
4. No campo abaixo, digite `Primeira versão do app` e clique no botão verde **"Commit changes"**.

### 3️⃣ Passo: Conectar na Vercel
1. Vá para o painel da [Vercel](https://vercel.com/dashboard).
2. Clique no botão azul **"Add New"** -> **"Project"**.
3. No campo "Import Git Repository", você verá o seu repositório `bliq-money`. Clique em **"Import"**.
4. **IMPORTANTE - CONFIGURAÇÃO DE IA:**
   - Procure a seção **"Environment Variables"**.
   - No campo **Key**, digite: `API_KEY`
   - No campo **Value**, cole a sua chave da Gemini API.
   - Clique em **Add**.
5. Clique no botão **"Deploy"**.

### 4️⃣ Passo: Instalar no iPhone 13
1. Assim que a Vercel terminar, ela te dará um link (ex: `https://bliq-money.vercel.app`).
2. Abra este link no **Safari** do seu iPhone.
3. Toque no botão **Compartilhar** (ícone do quadrado com seta para cima).
4. Role para baixo e toque em **"Adicionar à Tela de Início"**.
5. Clique em **Adicionar**.

---
✨ **Pronto!** Agora você tem um app nativo que roda em tela cheia no seu iPhone.
