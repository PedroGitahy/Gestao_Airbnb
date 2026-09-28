# Central RGR · Artem

Site público e central de gestão das unidades da RGR no Artem (Jardim Anália Franco, São Paulo).

- **Site** (`/`): apresenta o prédio e o bairro, leva o hóspede ao Airbnb/Booking e recebe pedidos de reserva direta.
- **Central** (`/central`): painel do dia, calendário das unidades, reservas, portaria, limpeza, manutenção, financeiro, equipe e configurações. Funciona no celular e pode ser instalada como aplicativo (menu do navegador › Adicionar à tela inicial).
- **Guia do hóspede** (`/guia/<código>`): uma página por unidade, em português e inglês, com o Wi-Fi daquela unidade.
- **Sincronização iCal**: a cada 30 minutos lê o calendário do Airbnb e do Booking de cada unidade, cria as reservas, cancela as que sumiram e gera a escala de limpeza.
- **API para o agente de IA** (`/api/agent/...`): o n8n consulta hóspedes e o dia, e abre ocorrências.

## Perfis de acesso

| Perfil | Vê |
| --- | --- |
| Gestor | tudo |
| Atendimento | painel, calendário, reservas, portaria, contatos, limpeza, manutenção |
| Governança | painel, calendário, limpeza (atribui e vistoria), manutenção, unidades (leitura), portaria |
| Camareira | só a limpeza do dia (as dela e as sem responsável) e abertura de ocorrências |

## Publicar no Easypanel (servidor Hostinger)

### 1. Banco de dados
1. No Easypanel, abra o projeto (ou crie um chamado `rgr`) › **+ Service › Postgres**.
2. Nome: `rgr-db`. Anote a **Internal Connection URL** (algo como `postgres://postgres:SENHA@rgr_rgr-db:5432/rgr`).

### 2. Aplicativo
1. **+ Service › App**, nome `artem`.
2. **Source › GitHub**: repositório `PedroGitahy/Gestao_Airbnb`, branch `main`. (Na primeira vez, o Easypanel pede para conectar sua conta do GitHub.)
3. **Build › Dockerfile** (o arquivo já está na raiz).
4. **Environment**, cole e ajuste:
   ```
   DATABASE_URL=<Internal Connection URL do passo 1>
   AUTH_SECRET=<resultado de: openssl rand -base64 32>
   ADMIN_EMAIL=pedro@rgr-ia.com
   ADMIN_PASSWORD=<senha forte para o primeiro acesso>
   SITE_URL=https://artem.rgr-ia.com
   AGENT_API_KEY=<resultado de: openssl rand -hex 24>
   ICAL_SYNC_MINUTES=30
   ```
5. **Domains**: adicione `artem.rgr-ia.com`, porta `3000`, HTTPS ligado.
6. **Deploy**. Na primeira subida o sistema cria as tabelas, as 20 unidades (U01 a U20) e o seu usuário de gestor.

### 3. Domínio
No painel de DNS do `rgr-ia.com`, crie um registro **A** com nome `artem` apontando para o IP do servidor. O certificado HTTPS sai sozinho pelo Easypanel em alguns minutos.

### 4. Primeiros passos na central
1. Entre em `https://artem.rgr-ia.com/central` com o e-mail e a senha do passo 2. **Troque a senha** em Equipe.
2. **Configurações**: WhatsApp da central, telefones da portaria e do plantão, links dos anúncios.
3. **Unidades**: para cada unidade, preencha apto, andar, Wi-Fi, custos fixos e cole os links iCal do Airbnb e do Booking.
4. Em cada plataforma, importe o link de saída que aparece na página da unidade. Assim uma reserva direta bloqueia as datas no Airbnb e no Booking.
5. **Equipe**: cadastre atendimento, governança e camareiras.

### Atualizações
Cada `git push` na branch `main` pode publicar sozinho: no app do Easypanel, ative **Auto Deploy**. Mudanças de banco rodam na inicialização (arquivo `src/lib/schema.ts`, lista `MIGRATIONS`).

### Backup
No serviço `rgr-db`, ative **Backups** diários (o Easypanel envia para um S3 ou guarda no servidor). O banco é o único lugar onde os dados moram.

## Agente de IA (n8n)

Todas as chamadas levam o cabeçalho `Authorization: Bearer <AGENT_API_KEY>`.

| Chamada | Para quê |
| --- | --- |
| `GET /api/agent/hoje` | entradas, saídas, limpezas e ocorrências do dia (aceita `?data=AAAA-MM-DD`) |
| `GET /api/agent/hospede?telefone=11999998888` | estadia atual ou próxima do hóspede: unidade, datas, guia e, a partir da véspera, o Wi-Fi |
| `POST /api/agent/ocorrencia` | abre ocorrência. Corpo: `{"unidade":"U05","titulo":"Chuveiro sem água quente","prioridade":"p2"}` |

Sugestões de fluxo no n8n:
- **Hóspede no WhatsApp** › `hospede?telefone=` › o modelo responde com os dados certos; se for defeito, `POST ocorrencia` e avisa a governança.
- **Resumo das 8h** › `hoje` › o modelo escreve o resumo e envia para o seu WhatsApp.

Para o agente encontrar o hóspede, o telefone precisa estar na reserva (campo WhatsApp).

## Desenvolvimento local

```bash
cp .env.example .env.local   # ajuste DATABASE_URL para um Postgres local
npm install
npm run dev
```

Tecnologia: Next.js 15, PostgreSQL (biblioteca `postgres`), sessões com JWT assinado em cookie `httpOnly`, senhas com bcrypt.
