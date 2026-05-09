# FinançasPro 💚
**Dashboard Financeiro para Autônomos e Pequenos Empreendedores**

---

## 📁 Estrutura de Pastas

```
financas/
├── html/
│   ├── login.html        ← Tela de login e cadastro
│   └── dashboard.html    ← Dashboard principal
├── css/
│   ├── global.css        ← Variáveis, reset, componentes globais
│   ├── login.css         ← Estilos da tela de login
│   └── dashboard.css     ← Estilos do dashboard (sidebar, cards, gráficos)
├── js/
│   ├── db.js             ← Camada de dados segura (Web Crypto API)
│   ├── auth.js           ← Lógica de login/registro
│   ├── dashboard.js      ← Lógica principal do dashboard
│   └── charts.js         ← Todos os gráficos (Chart.js)
└── README.md
```

---

## 🔐 Segurança do Banco de Dados

Todos os dados do usuário são **criptografados no dispositivo** antes de serem salvos. Ninguém (nem o servidor) consegue ler seus dados sem a senha.

| Recurso | Detalhe |
|---|---|
| **Criptografia** | AES-GCM 256-bit (Web Crypto API nativa do browser) |
| **Derivação de chave** | PBKDF2 com 310.000 iterações + SHA-256 |
| **IV** | Aleatório e único a cada gravação (12 bytes) |
| **Salt** | 32 bytes aleatórios por usuário |
| **Senha** | Nunca salva — apenas o hash SHA-256 com salt |
| **Sessão** | Armazenada em `sessionStorage` (apagada ao fechar aba) |
| **Expiração** | Sessão expira automaticamente em 8 horas |
| **Rate limit** | Bloqueio de 15 min após 5 tentativas de login |
| **XSS** | Todos os dados exibidos passam por `escHtml()` |
| **Isolamento** | Cada usuário tem namespace e chave criptográfica própria |

---

## 🚀 Como Usar

### Opção 1 – Abrir localmente (sem servidor)
1. Abra a pasta `financas/html/`
2. Clique duplo em `login.html`
3. Pronto — tudo funciona direto no navegador!

> ⚠️ No Chrome, algumas APIs de criptografia podem exigir `localhost` ou `https`.
> Use a extensão **Live Server** (VS Code) ou o Python server abaixo.

### Opção 2 – Servidor local rápido (Python)
```bash
cd financas
python3 -m http.server 8080
# Acesse: http://localhost:8080/html/login.html
```

### Opção 3 – VS Code Live Server
1. Instale a extensão **Live Server**
2. Clique com botão direito em `login.html` → "Open with Live Server"

---

## ✨ Funcionalidades

- **Login seguro** com força de senha e proteção por rate-limit
- **Cadastro de usuários** com validação completa
- **Transações** com CRUD completo (criar, editar, excluir)
- **Filtros** por tipo, custo e busca por texto
- **Visão geral** com cards de receita, despesa, lucro e custo fixo
- **Gráficos interativos**: Barras, Pizza, Linha de projeção
- **Fluxo de caixa** com projeção automática dos próximos 3 meses
- **Relatórios** com exportação em CSV (compatível Excel/Google Sheets)
- **100% responsivo** — funciona perfeitamente no celular
- **Dark mode** moderno com design profissional

---

## 🎨 Stack Tecnológica

- HTML5 + CSS3 (variáveis CSS, Grid, Flexbox, animações)
- JavaScript ES2022 (vanilla — sem framework)
- **Web Crypto API** (criptografia nativa, sem bibliotecas externas)
- **Chart.js 4** (gráficos)
- **Google Fonts** (Syne + DM Sans)

---

## 📧 Suporte
jrcontatosdf@gmail.com
