# Deploy — Droplet (API) + Vercel (front)

**Status: no ar.** Front em <https://controle-escolas.vercel.app>, API em
`https://api-escolas.157-230-2-150.nip.io` (HTTPS via Let's Encrypt, proxy pelo Nginx Proxy
Manager do droplet). Login inicial: e-mail da dona configurado no `.env` do droplet, senha trocável
pela aba "Usuários" assim que logar. O passo a passo abaixo já foi executado uma vez — fica
registrado para a próxima vez que precisar refazer (novo domínio, outro droplet, etc.).

| Peça | Onde | Como |
|---|---|---|
| Front (`public/`) | **Vercel** | projeto `controle-escolas`, sem domínio próprio ainda — usa a URL `*.vercel.app` |
| API (`server.js`) | **Droplet DO** 157.230.2.150 | `.github/workflows/deploy-droplet.yml` builda a imagem, publica em `ghcr.io/luizmagacho/controle-escolas` e reinicia o container via SSH a cada push em `main` |
| Banco | **MongoDB** num container no próprio droplet | `deploy/docker-compose.yml`, volume próprio, só na rede interna `web` (nunca exposto) |

Sem domínio próprio ainda, a API usa um hostname temporário via [nip.io](https://nip.io) (resolve
para o IP do droplet sem precisar comprar nada): `https://api-escolas.157-230-2-150.nip.io`. Troque
por um domínio de verdade quando tiver um — é só repetir o passo 3 com o novo nome e atualizar
`API_BASE_URL` na Vercel.

## 1. Segredos do GitHub (uma vez, no repo `luizmagacho/controle-escolas`)

```bash
gh secret set DROPLET_SSH_KEY < ~/.ssh/id_ed25519 --repo luizmagacho/controle-escolas
```

`GITHUB_TOKEN` já existe automaticamente em toda run do Actions.

## 2. Primeira vez no droplet (`/opt/controle-escolas`)

```bash
ssh root@157.230.2.150
mkdir -p /opt/controle-escolas
# copiar deploy/docker-compose.yml pra lá (scp local, ou colar direto)
cd /opt/controle-escolas
cat > .env <<'EOF'
PORT=3200
MONGODB_URI=mongodb://mongo:27017/controle-escolas
SEED_OWNER_EMAIL=<email da dona>
SEED_OWNER_PASSWORD=<senha forte — troque pelo app depois que logar>
SESSION_TTL_HOURS=168
COOKIE_SECURE=1
CORS_ORIGINS=
EOF
docker compose pull && docker compose up -d
```

`COOKIE_SECURE=1` é obrigatório aqui: a Vercel chama a API num domínio diferente, e sem isso o
cookie de sessão nunca seria aceito pelo navegador (ver `server.js`, `COOKIE_SAMESITE`).

## 3. Proxy HTTPS (Nginx Proxy Manager, já rodando no droplet)

Na UI do NPM (porta 81 do droplet):

1. **Proxy Hosts → Add Proxy Host**
2. Domain: `api-escolas.157-230-2-150.nip.io` (ou o domínio de verdade, quando houver um)
3. Forward: `controle-escolas-api-1` (nome do container — confirme com `docker ps` no droplet) : `3200`
4. **SSL** → Request a new SSL certificate (Let's Encrypt), forçar HTTPS

## 4. Projeto na Vercel

```bash
cd controle-escolas
vercel link      # associa esta pasta a um projeto Vercel (cria um novo se pedir)
vercel env add API_BASE_URL production   # cole: https://api-escolas.157-230-2-150.nip.io
vercel --prod
```

O `buildCommand` do `vercel.json` (`node scripts/build-vercel-config.js`) escreve essa URL em
`public/config.js` no momento do build — nada disso afeta o dev local nem o droplet servindo a si
mesmo (lá, `config.js` continua com `''`, ou seja, mesma origem).

A API já aceita automaticamente qualquer origem `https://*.vercel.app` (então funciona sem
configurar nada extra), incluindo os deploys de preview.

## 5. Confirmar

```bash
curl -I https://api-escolas.157-230-2-150.nip.io/api/schools   # 401 esperado (sem sessão) — prova que respondeu
curl -H "Origin: https://controle-escolas.vercel.app" -I https://api-escolas.157-230-2-150.nip.io/api/schools
```

Depois, abrir a URL da Vercel, logar com o e-mail/senha do `.env` acima, e trocar a senha pelo app
(aba "Usuários").

## Pendências conhecidas

- Sem domínio próprio: a API depende do nip.io (funciona, mas o IP fica visível na URL). Trocar
  quando houver um domínio — repita o passo 3 com o novo nome e rode `vercel env rm API_BASE_URL`
  seguido de `vercel env add API_BASE_URL production` com a nova URL, depois `vercel --prod`.
- `SEED_OWNER_PASSWORD` do `.env` é só usada na primeira vez que o banco está vazio — depois disso,
  trocar a senha só pelo app (aba Usuários), nunca editando o `.env`.
- A senha do Nginx Proxy Manager (porta 81) foi resetada direto no banco (`/data/database.sqlite`
  do container `npm-app-1`, tabela `auth`) em 2026-09-24 porque tinha sido perdida — troque de novo
  pela própria UI do NPM se quiser uma senha memorizável.
