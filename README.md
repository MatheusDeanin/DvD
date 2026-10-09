# 🎮 Discord dos Amigos — 100% Grátis, Sem Censura & Anti-Sleep

Um clone completo do **Discord** criado especialmente para você jogar e conversar com até **10 amigos**, com **compartilhamento de tela**, **câmeras**, canais de **voz e texto**, **personalização de perfil**, banco de dados na nuvem **Neon PostgreSQL** e sistema **Anti-Sleep** automático para hospedagem gratuita no **Render**.

---

## ✨ Recursos Principais

- 🎤 **Canais de Voz & WebRTC Peer-to-Peer**: Latência ultrabaixa para até 10 amigos, detecção de fala com anel verde brilhante em volta do avatar.
- 🖥️ **Compartilhamento de Tela 60 FPS**: Sem bloqueios ou restrições de Discord Nitro! Compartilhe gameplay, guias ou vídeos com áudio.
- 📷 **Câmeras de Vídeo**: Transmita sua webcam ao vivo em grade adaptável estilo Discord.
- 💬 **Canais de Texto em Tempo Real**: Mensagens instantâneas via WebSockets, formatação Markdown, envio de links e imagens diretas, emojis e indicador de digitação.
- 🗄️ **Banco de Dados Neon PostgreSQL**: Integração nativa com o plano 100% gratuito do [Neon.tech](https://neon.tech), com migração e criação automática das tabelas.
- ⏰ **Sistema Anti-Sleep Integrado (Render)**: Loop de self-ping inteligente a cada 10 minutos para evitar que a instância gratuita do Render entre em modo de suspensão (*sleep*).
- 🎨 **Personalização Completa de Perfil**: Mude Nome de Exibição, Apelido, Avatar personalizado, Cor do Banner, Biografia (*Sobre Mim*), Modo de Status (Online, Ausente, Não Perturbe, Invisível) e Mensagem de Status ("*Jogando com os guris*").
- 🔓 **Sem Censura**: Nenhum algoritmo de moderação intrusivo ou filtros de palavras arbitrários. Total liberdade para você e seus amigos.
- 👥 **Sistema de Servidores e Convites**: Servidor padrão com código de convite `AMIGOS10`, além de suporte para criar novos servidores e canais.

---

## 🚀 Como Rodar Localmente (Teste Rápido)

1. Abra a pasta do projeto no terminal:
   ```bash
   cd "C:\Users\Matheus Deanin\.gemini\antigravity\scratch\discord-app"
   ```

2. Inicie o servidor:
   ```bash
   npm start
   ```

3. Abra seu navegador em:
   ```
   http://localhost:3001
   ```

> 💡 **Nota:** Se você ainda não configurou uma `DATABASE_URL` do Neon, o sistema iniciará automaticamente em **modo de memória local**, permitindo testar tudo imediatamente!

---

## 🐘 Passo a Passo: Banco de Dados Neon (100% Grátis)

1. Acesse **[neon.tech](https://neon.tech)** e crie uma conta gratuita (com GitHub ou Google).
2. Clique em **"Create Project"** e dê um nome (ex: `discord-db`).
3. Na tela inicial do painel, você verá a sua **Connection String** no formato:
   ```
   postgresql://usuario:senha@ep-exemplo.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Copie essa URL.
5. Crie um arquivo `.env` na raiz do projeto ou configure na aba Environment do Render:
   ```env
   DATABASE_URL=postgresql://usuario:senha@ep-exemplo.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
6. O servidor irá criar **todas as tabelas automaticamente** na primeira inicialização!

---

## ☁️ Passo a Passo: Hospedar Grátis no Render (com Anti-Sleep)

O **Render.com** permite hospedar serviços Node.js gratuitamente. O repositório já está 100% preparado para rodar no Render em 1 único serviço!

### Opção A: Deploy pelo GitHub
1. Crie um repositório no seu GitHub e suba este projeto.
2. Acesse **[render.com](https://render.com)** e clique em **New +** -> **Web Service**.
3. Conecte seu repositório GitHub.
4. Preencha as configurações:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build --prefix client`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
5. Na aba **Environment Variables**, adicione:
   - `DATABASE_URL`: *(sua connection string do Neon)*
   - `JWT_SECRET`: *(qualquer texto longo para criptografia)*
   - `APP_URL`: *(a URL que o Render gerou para você, ex: `https://meu-discord.onrender.com`)*
6. Clique em **Deploy Web Service**!

---

## ⚡ Como Funciona o Anti-Sleep (Render 24/7 Ativo)

O plano gratuito do Render desliga a aplicação após 15 minutos sem visitas. Nosso sistema resolve isso de duas formas:

1. **Self-Ping Interno**: O servidor possui um temporizador que requisita o seu próprio endpoint `/api/health` a cada 10 minutos.
2. **Monitor em Tempo Real**: Na barra lateral e nas configurações do usuário, você pode ver o status do Anti-Sleep, total de pings realizados e tempo de resposta.
3. **Redundância Externa (Recomendada para 100% de garantia)**:
   - Acesse o site gratuito **[cron-job.org](https://cron-job.org)**.
   - Crie uma tarefa para chamar a cada 10 minutos a URL: `https://sua-aplicacao.onrender.com/api/health`.
   - Pronto! O Render nunca mais dormirá e você não paga nada por isso.

---

## 👥 Como Convidar Seus Amigos

1. Compartilhe o link do seu site (ex: `https://seu-discord.onrender.com`).
2. Cada amigo pode clicar em **"Criar Conta"** ou usar o botão de **"Criar Amigo"**.
3. O servidor principal **"Lobby dos Amigos"** já estará visível para todos com o código de convite `AMIGOS10`.
4. Basta entrar nos canais de voz para falar por microfone, abrir a câmera ou clicar em **"Compartilhar Tela"**!
