# LIQ SAAS — Plataforma de Atendimento, Pedidos e Fidelização para Restaurantes

Plataforma Multi-Tenant moderna de autoatendimento via **QR Code / NFC nas mesas**, gestão operacional de pedidos para a cozinha (**KDS - Kitchen Display System**), controle de mesas em tempo real, **CRM inteligente** com carteira de fidelização por pontos, cupons promocionais e métricas em tempo real.

Construída para alta performance, aderindo a padrões de código limpo: **HTML5 semântico**, **CSS modular puro** (estritamente zero CSS inline e zero tags `<style>` internas), **Vanilla JavaScript modular** (sem frameworks pesados), **PHP 8+ nativo** e **MySQL 5.7+ / MariaDB 10.3+**.

---

## Sumário

- [1. Infraestrutura Multi-Subdomínio e Arquitetura](#1-infraestrutura-multi-subdomínio-e-arquitetura)
- [2. Estrutura de Pastas do Projeto](#2-estrutura-de-pastas-do-projeto)
- [3. Identidade Visual e Diretrizes de Design](#3-identidade-visual-e-diretrizes-de-design)
- [4. Módulos da Aplicação](#4-módulos-da-aplicação)
  - [4.1. Landing Page Institucional](#41-landing-page-institucional)
  - [4.2. Fluxo de Autenticação & Onboarding](#42-fluxo-de-autenticação--onboarding)
  - [4.3. Plataforma do Restaurante (User Dashboard & KDS)](#43-plataforma-do-restaurante-user-dashboard--kds)
  - [4.4. Autoatendimento do Cliente na Mesa (Client PWA)](#44-autoatendimento-do-cliente-na-mesa-client-pwa)
  - [4.5. Backoffice Super-Admin](#45-backoffice-super-admin)
- [5. Backend & API RESTful (`/api`)](#5-backend--api-restful-api)
  - [5.1. Roteamento e Normalização de Prefixos](#51-roteamento-e-normalização-de-prefixos)
  - [5.2. Catálogo Oficial de Endpoints REST](#52-catálogo-oficial-de-endpoints-rest)
- [6. Banco de Dados & Modelo Relacional](#6-banco-de-dados--modelo-relacional)
- [7. Utilitários e Componentes Centrais](#7-utilitários-e-componentes-centrais)
- [8. Guia de Instalação e Execução Local](#8-guia-de-instalação-e-execução-local)
- [9. Credenciais Padrão de Demonstração](#9-credenciais-padrão-de-demonstração)

---

## 1. Infraestrutura Multi-Subdomínio e Arquitetura

Em ambiente de produção, a plataforma opera distribuída através de subdomínios especializados, mantendo uma única base de código e banco de dados centralizado multi-tenant:

```
                               ┌────────────────────────────────┐
                               │       Plataforma LIQ SAAS       │
                               └────────────────────────────────┘
                                                │
         ┌──────────────────┬───────────────────┼───────────────────┬──────────────────┐
         ▼                  ▼                   ▼                   ▼                  ▼
      liq.ao            app.liq.ao          app.liq.ao          api.liq.ao       backoffice.liq.ao
   Landing Page     Redireciona para login  Plataforma e PWA    /app-api/...        Super-Admin
  (Apresentação)      (/auth/login)         /user/{slug}         (API REST)       (Gestor Global)
                                            /client/ (Mesa)
```

| Domínio / Caminho | Função | Descrição e Comportamento |
|---|---|---|
| **`liq.ao`** | Landing Page | Página de apresentação com vitrine, cálculo de planos, demonstração 3D interativa e FAQ. |
| **`app.liq.ao`** | Aplicação Restaurantes | Redireciona imediatamente para o fluxo de login em `/auth/login`. |
| **`app.liq.ao/auth/login`** | Login do Restaurante | Autenticação com validação estrita, sessão segura persistente e redirecionamento. |
| **`app.liq.ao/auth/register`** | Cadastro do Restaurante | Registro de novas contas com criação de tenant e onboard passo a passo. |
| **`app.liq.ao/auth/onboard`** | Questionário Inicial | Configurações operacionais e perfil de gestão do restaurante. |
| **`app.liq.ao/auth/otp`** | Verificação OTP | Validação de segurança em 4 a 6 dígitos com suporte a código de teste e reenvio. |
| **`app.liq.ao/auth/resend`** | Redefinição de Senha | Verificação de e-mail na base de dados com geração de link e token válido por **10 minutos**. |
| **`app.liq.ao/auth/new-password/{token}`** | Nova Senha | Formulário de criação de nova senha seguro via token. |
| **`app.liq.ao/user/{slug}`** | Plataforma do Restaurante | Painel com métricas em tempo real, quadro KDS para a cozinha, mesas e CRM. |
| **`app.liq.ao/client/`** | PWA do Cliente | Cardápio digital na mesa com acesso via QR Code ou NFC, carrinho e checkout. |
| **`api.liq.ao/app-api`** | Central de APIs | Todas as APIs RESTful da plataforma com headers CORS e autenticação. |
| **`backoffice.liq.ao`** | Painel do Gestor Geral | Painel administrativo global para acompanhamento de todos os restaurantes. |

> **Compatibilidade em Desenvolvimento (XAMPP / Localhost)**:
> O cliente de API [`utils/functions/useApi.js`](file:///c:/xampp/htdocs/liq/utils/functions/useApi.js) detecta o ambiente automaticamente: se estiver sob `localhost` ou `127.0.0.1`, consome `/liq/api`; se estiver em produção sob `*.liq.ao`, conecta dinamicamente a `https://api.liq.ao/app-api`.

---

## 2. Estrutura de Pastas do Projeto

Todo o código PHP, variáveis de ambiente, configurações de banco e regras de roteamento do servidor residem de forma isolada na pasta `/api`:

```
c:/xampp/htdocs/liq/
├── .htaccess                   # Roteamento no nível raiz (redirecionamento de app.liq.ao e URL amigáveis)
├── index.html                  # Landing Page institucional oficial
├── README.md                   # Documentação técnica completa
│
├── api/                        # NÚCLEO COMPLETO DO BACKEND (PHP, ENV, CONFIG, DB)
│   ├── .env                    # Variáveis de ambiente locais (desenvolvimento)
│   ├── .env.example            # Modelo de configuração para deploy em produção
│   ├── .htaccess               # Regras Apache do backend (Authorization header e rewrite para index.php)
│   ├── index.php               # Front Controller central da API REST
│   │
│   ├── config/
│   │   ├── app.php             # Constantes globais, domínios autorizados e CORS
│   │   └── database.php        # Conexão PDO segura (UTF-8 MB4, sem emulate prepares)
│   │
│   ├── core/
│   │   ├── Env.php             # Carregador nativo de arquivos .env com tipagem
│   │   ├── Request.php         # Parser de requisições HTTP (JSON body, query, headers, cookies, IP)
│   │   ├── Response.php        # Respostas JSON padronizadas com sanitização de chaves confidenciais
│   │   ├── Router.php          # Roteador REST inteligente com normalização automática de caminhos
│   │   └── Security.php        # BCRYPT 12, tokens SHA-256, cookies HttpOnly e UUID v4
│   │
│   ├── middleware/
│   │   └── CorsMiddleware.php  # Gerenciamento de CORS para subdomínios liq.ao e localhost
│   │
│   ├── controllers/
│   │   ├── AuthController.php       # Endpoints de login, registro, recuperação (10min), OTP
│   │   ├── MenuController.php       # Cardápio digital e resolução de mesas via QR/NFC
│   │   ├── OrderController.php      # Criação e ciclo de vida de pedidos, KDS de cozinha
│   │   ├── CustomerController.php   # Sessões persistentes e carteira de pontos
│   │   ├── CouponController.php     # Validação de cupons em tempo real no servidor
│   │   ├── DashboardController.php  # Métricas financeiras e analíticas do restaurante
│   │   └── BackofficeController.php # Métricas multi-tenant do super-admin
│   │
│   ├── services/
│   │   ├── AuthService.php          # Lógica de negócio de autenticação multi-tenant
│   │   ├── CustomerSessionService.php # Sessões multi-camada (cookie + device UUID + hash SHA-256)
│   │   ├── DashboardService.php     # Indicadores de ticket médio, faturamento e pico de pedidos
│   │   └── OrderService.php         # Validação financeira estrita de preços e cupons
│   │
│   └── database/
│       ├── schema.sql          # Schema DDL oficial com 17 tabelas relacionais InnoDB
│       └── migrate.php         # Script CLI de migração de banco de dados
│
├── assets/                     # RECURSOS VISUAIS ESTÁTICOS
│   ├── images/                 # Logotipos (logo.png, logo-white.png), mockups e imagens de banner
│   ├── script/                 # Scripts do frontend
│   │   ├── icons.js            # Biblioteca central de ícones vetoriais SVG (AppIcons)
│   │   ├── landing.js          # Controladora da Landing Page (3D Tilt, modal, FAQ, preços)
│   │   ├── auth-login.js       # Controladora de login com máquina de estados de botões
│   │   ├── auth-register.js    # Controladora de cadastro de restaurantes
│   │   ├── auth-resend.js      # Controladora de recuperação de senha
│   │   ├── auth-otp.js         # Controladora de verificação OTP
│   │   ├── client.js           # PWA de autoatendimento para clientes na mesa
│   │   └── user.js             # Painel operacional do restaurante e quadro KDS
│   │
│   └── style/                  # FOLHAS DE ESTILO CSS PURAS (ZERO INLINE / ZERO TAGS STYLE)
│       ├── global.css          # Variáveis de tema oficiais, reset e tipografia Open Sans
│       ├── components.css      # Botões, spinner, inputs, badges, cards e modais
│       ├── landing.css         # Estilização completa da Landing Page e Navbar Glassmorphic
│       ├── auth.css            # Layout em duas colunas dos fluxos de autenticação
│       ├── client.css          # Interface PWA mobile-first do cliente
│       └── user.css            # Dashboard operacional e quadro de cozinha KDS
│
├── auth/                       # PÁGINAS DOS FLUXOS DE AUTENTICAÇÃO
│   ├── login/index.html        # Página de login de restaurantes
│   ├── register/index.html     # Página de registro de restaurante
│   ├── onboard/index.html      # Onboarding com questionário de perfil
│   ├── otp/index.html          # Verificação de código OTP
│   ├── resend/index.html       # Solicitação de redefinição de senha
│   └── new-password/index.html # Redefinição de senha com validação de token
│
├── client/                     # PWA DO CLIENTE NA MESA
│   └── index.html              # Interface de menu digital por QR Code (?t=07) e checkout
│
├── user/                       # PLATAFORMA DO RESTAURANTE
│   └── index.html              # Dashboard analítico, KDS, mesas, CRM e cupons
│
└── utils/                      # UTILITÁRIOS E FUNÇÕES COMPARTILHADAS DO FRONTEND
    ├── function/
    │   └── useAlert.js         # Sistema unificado de alertas profissionais (sucesso, aviso, erro, info)
    └── functions/
        ├── useApi.js           # Cliente HTTP fetch adaptativo com suporte a cross-subdomain
        ├── useFormatters.js    # Formatação de moedas (Kz), datas e telemóveis
        ├── usePanels.js        # Chaveamento dinâmico de abas/painéis sem reload
        └── useValidation.js    # Validações estritas de e-mails, senhas e campos obrigatórios
```

---

## 3. Identidade Visual e Diretrizes de Design

A plataforma segue rigorosas diretrizes de engenharia de software e design visual:

### 3.1. Tipografia Principal
- **Fonte Oficial**: **Open Sans** carregada de forma otimizada via Google Fonts em [`assets/style/global.css`](file:///c:/xampp/htdocs/liq/assets/style/global.css).
- Utilizada de forma padronizada em todos os títulos, botões, formulários e textos da plataforma.

### 3.2. Paleta de Cores Oficial

```css
:root {
  --c-neon-green:   #06f956;  /* Destaques luminosos e estados de foco */
  --c-dark-forest:  #032204;  /* Cor primária escura, títulos e rodapé */
  --c-mint-light:   #e0fae9;  /* Fundos suaves, badges e contrastes claros */
  --c-emerald:      #149036;  /* Verde oficial de ação, links e botões hover */
  --c-leaf-green:   #26cd59;  /* Verde ativo padrão de botões e CTAs primários */
  --c-deep-green:   #024d10;  /* Verde profundo para bordas e gradientes */
  --c-pastel-green: #95efb3;  /* Acentos claros e bordas sutis */
}
```

### 3.3. Regras de Logotipo
- **Fundo Verde ou Fundo Escuro**: Deve utilizar obrigatoriamente [`assets/images/logo-white.png`](file:///c:/xampp/htdocs/liq/assets/images/logo-white.png).
- **Fundo Claro / Branco**: Deve utilizar [`assets/images/logo.png`](file:///c:/xampp/htdocs/liq/assets/images/logo.png).
- **Favicon**: [`assets/images/favicon.png`](file:///c:/xampp/htdocs/liq/assets/images/favicon.png).

### 3.4. Regras Estritas de Implementação
1. **Zero CSS Inline e Zero Tags `<style>`**: Nenhum elemento HTML contém o atributo `style="..."` ou tags `<style>` internas. Todas as estilizações residem em arquivos `.css` externos sob `/assets/style/`.
2. **Zero Emojis**: É estritamente proibido o uso de emojis na interface. Todos os símbolos utilizam exclusivamente ícones vetoriais SVG carregados pelo utilitário [`AppIcons`](file:///c:/xampp/htdocs/liq/assets/script/icons.js) através do atributo `data-icon="..."`.
3. **Máquina de Estados em Botões de Formulário**: Todo botão de submissão implementa 4 estados visuais:
   - **Esperado Click (Idle)**: Estilização padrão, habilitado.
   - **Hover**: Realce de cor e leve elevação.
   - **Ativo (Active)**: Efeito de clique.
   - **Clicado / Processando (Submit)**: Classe `.is-loading`, atributo `disabled` ativado, texto descritivo e animação vetorial `.btn-spinner`.

---

## 4. Módulos da Aplicação

### 4.1. Landing Page Institucional (`index.html`)
- **Header Frosted Glassmorphism**: Transparente com desfoque de fundo em tempo real (`backdrop-filter: blur(16px)`), tanto em desktop quanto mobile.
- **Menu Mobile Dropdown**: Botão hamburger discreto que aciona menu suspenso de vidro com todas as opções de navegação (**Funcionalidades**, **Preços**, **FAQ**) e botões de conversão (**Entrar**, **Começar agora**).
- **Hero Interativo**:
  - Padrão geométrico de fundo em quadrados (*squares grid* de $26\text{px} \times 26\text{px}$), com iluminação radial suave.
  - Imagem de mockup suspensa sem borda de caixa ([`hero-img.png`](file:///c:/xampp/htdocs/liq/assets/images/hero-img.png)), posicionada estrategicamente e dotada de **efeito de inclinação 3D dinâmico (3D Tilt)** que responde em tempo real à posição do cursor do mouse.
  - Botão secundário de contato direto via WhatsApp: *"Fale connosco"*.
- **Banners Parallax**: Faixas intermediárias e finais com efeito parallax configuradas com [`sections-img01.jpg`](file:///c:/xampp/htdocs/liq/assets/images/sections-img01.jpg) e [`sections-img02.jpg`](file:///c:/xampp/htdocs/liq/assets/images/sections-img02.jpg).
- **Tabela de Preços Dinâmica**: Chaveador de ciclo de faturamento **Mensal / Anual** com cálculo automático de 20% de desconto.
- **FAQ Accordion**: Respostas expansíveis e retráteis instantâneas.

### 4.2. Fluxo de Autenticação & Onboarding (`/auth/`)
1. **Login (`/auth/login`)**:
   - Autenticação de gestores e funcionários com validação no frontend e envio para `POST /auth/login`.
   - Armazenamento de sessão e redirecionamento dinâmico para a plataforma do restaurante correspondente.
2. **Cadastro (`/auth/register`)**:
   - Cadastro completo (Nome do restaurante, e-mail, telefone/WhatsApp, senha com indicador de força, localização).
3. **Onboarding (`/auth/onboard`)**:
   - Questionário com perguntas estratégicas (ex: sistema de gestão atual, número de mesas, tipo de cozinha).
4. **Verificação OTP (`/auth/otp`)**:
   - 4 blocos de entrada numérica com avanço e retrocesso automático de foco, verificação de código e cronômetro de reenvio.
5. **Recuperação de Senha (`/auth/resend`)**:
   - Validação se o e-mail consta na base de dados. Se o e-mail não existir, a plataforma barra com notificação de segurança via `useAlert`. Se existir, gera token criptográfico seguro com validade de **10 minutos**.
6. **Nova Senha (`/auth/new-password/{token}`)**:
   - Definição de nova senha com validação de força e confirmação de senha.

### 4.3. Plataforma do Restaurante (`/user/`)
- **Dashboard de Indicadores Operacionais**:
  - Vendas do dia, faturamento de ontem e percentual de crescimento calculado no servidor.
  - Ticket médio atualizado em tempo real.
  - Contagem de clientes atendidos e taxa de retorno de clientes fidelizados.
- **Quadro de Cozinha KDS (Kitchen Display System)**:
  - Fila de pedidos classificados por estado (`PENDING`, `CONFIRMED`, `PREPARING`, `READY`).
  - Atualização de status em um clique com cálculo de tempo decorrido.
- **Gestão de Mesas**:
  - Monitoramento visual de mesas: Livres (`AVAILABLE`), Ocupadas (`OCCUPIED`) e em Limpeza (`CLEANING`).
- **Base CRM e Cupons**:
  - Histórico de pedidos por cliente, pontuação acumulada e criação de cupons com regras de pedido mínimo e validade.

### 4.4. Autoatendimento do Cliente na Mesa (`/client/`)
- Acesso sem necessidade de download ou login prévio através de URL parametrizada (ex: `client/index.html?t=07`).
- **Reconhecimento de Mesa e Restaurante**: Resolução instantânea do número da mesa por token criptográfico de QR Code ou NFC.
- **Identificação Transparente**: Criação ou restauração automática de sessão persistente no telemóvel do cliente através de Cookie Seguro (`liq_c_sess`) e UUID de dispositivo (`liq_d_id`).
- **Navegação do Cardápio**: Categorias com scroll suave, fotos de alta qualidade, preços em Kwanzas (`Kz`) e destaques.
- **Carrinho e Aplicação de Cupons**: Cálculo no cliente com validação 100% mandatória no backend.
- **Carteira de Fidelização**: Acompanhamento de pontos acumulados a cada pedido concluído.

### 4.5. Backoffice Super-Admin
- Endpoints REST dedicados em `/api/backoffice/overview` e `/api/backoffice/restaurants` para alimentar o subdomínio `backoffice.liq.ao`.
- Visão agregada de faturamento bruto movimentado (GMV), contagem de restaurantes ativos e acompanhamento de cadastros.

---

## 5. Backend & API RESTful (`/api`)

O backend foi construído do zero em **PHP 8+ nativo**, organizado segundo os princípios de Clean Architecture e separação de responsabilidades.

### 5.1. Roteamento e Normalização de Prefixos
O [`Router.php`](file:///c:/xampp/htdocs/liq/api/core/Router.php) possui normalização de rotas em tempo de execução:
- Remove dinamicamente subpastas locais (`/liq`)
- Normaliza prefixos de API (`/app-api`, `/api` ou rotas diretas)
- Extrai parâmetros de rota com expressões regulares (ex: `/orders/{id}/status`)
- Executa pré-flight requests `OPTIONS` retornando `204 No Content` com headers CORS completos

### 5.2. Catálogo Oficial de Endpoints REST

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/health` | Verificação de status e disponibilidade da API para balanceadores de carga. |
| `POST` | `/auth/login` | Login de proprietários e funcionários com BCRYPT e emissão de sessão. |
| `POST` | `/auth/register` | Criação de novo restaurante e usuário gestor associado. |
| `POST` | `/auth/verify-email` | Verificação de existência de e-mail e geração de token de recuperação (10 min). |
| `POST` | `/auth/verify-otp` | Validação de código numérico OTP de segurança. |
| `POST` | `/auth/new-password` | Redefinição de senha com validação de token temporário. |
| `POST` | `/auth/logout` | Encerramento de sessão e revogação de cookies de autenticação. |
| `GET` | `/menu` | Cardápio digital do restaurante e resolução de mesa via parâmetro `?t=token`. |
| `GET` | `/menu/{slug}` | Cardápio digital obtido pelo slug amigável do restaurante. |
| `POST` | `/customer/session` | Verificação de sessão persistente de cliente na mesa por cookie/device UUID. |
| `POST` | `/customer/identify` | Identificação ou autocadastro de cliente (Nome, WhatsApp, E-mail). |
| `GET` | `/customer/wallet` | Saldo de pontos de fidelidade e histórico de benefícios do cliente. |
| `POST` | `/orders` | Criação de pedido com validação financeira integral dos preços no servidor. |
| `GET` | `/orders/{id}` | Consulta de detalhes, status e itens de um pedido específico. |
| `PATCH` | `/orders/{id}/status` | Atualização do estado do pedido (`CONFIRMED`, `PREPARING`, `READY`, `COMPLETED`). |
| `GET` | `/orders/kitchen` | Listagem em tempo real de pedidos ativos para o display de cozinha (KDS). |
| `POST` | `/coupons/validate` | Validação de regras de cupom de desconto (data, pedido mínimo, limite por cliente). |
| `GET` | `/dashboard` | Consolidação analítica para o restaurante (vendas, ticket médio, horários de pico). |
| `GET` | `/backoffice/overview` | Métricas gerais de todos os tenants para o painel `backoffice.liq.ao`. |
| `GET` | `/backoffice/restaurants` | Listagem e volume de transações de todos os restaurantes da plataforma. |

---

## 6. Banco de Dados & Modelo Relacional

O schema oficial reside em [`api/database/schema.sql`](file:///c:/xampp/htdocs/liq/api/database/schema.sql) e implementa **17 tabelas** em conformidade com o padrão relacional MySQL InnoDB:

```
[restaurants] 1 ──── ∞ [tables]
      │
      ├─────── ∞ [categories] 1 ──── ∞ [products]
      │                                    │
      ├─────── ∞ [restaurant_users]        │
      │              │                     │
      │          [users]                   │
      │                                    │
      ├─────── ∞ [orders] 1 ──────── ∞ [order_items]
      │              │
      │          [customers] 1 ───── ∞ [customer_sessions]
      │              │
      ├─────── ∞ [coupons] 1 ─────── ∞ [coupon_redemptions]
      │
      ├─────── ∞ [loyalty_programs]
      │              │
      └─────── ∞ [loyalty_transactions]
```

### Tabelas Principais
1. **`restaurants`**: Dados cadastrais do restaurante, slug único, moeda (`Kz`), logotipo e status.
2. **`users`**: Administradores e operadores do sistema com senhas protegidas por BCRYPT.
3. **`restaurant_users`**: Tabela associativa multi-tenant que liga usuários a restaurantes e seus papéis (`RESTAURANT_OWNER`, `MANAGER`, `STAFF`).
4. **`tables`**: Cadastro de mesas com `qr_token` e `nfc_token` exclusivos e status operacional.
5. **`categories`** e **`products`**: Estrutura hierárquica do cardápio digital.
6. **`orders`** e **`order_items`**: Pedidos com histórico temporal de status e **snapshot inalterável de nome e preço** de cada item no momento da compra.
7. **`customers`** e **`customer_sessions`**: Registro de clientes e sessões persistentes seguras por token SHA-256 e UUID de dispositivo.
8. **`coupons`** e **`coupon_redemptions`**: Cupons de desconto percentuais ou de valor fixo, limites de uso e histórico de resgates.
9. **`loyalty_programs`** e **`loyalty_transactions`**: Regras de fidelidade e extrato de pontos ganhos e resgatados.
10. **`audit_logs`**, **`notifications`** e **`analytics_events`**: Auditoria de segurança, alertas operacionais e métricas de conversão.

---

## 7. Utilitários e Componentes Centrais

### 7.1. Sistema Unificado de Alertas ([`useAlert.js`](file:///c:/xampp/htdocs/liq/utils/function/useAlert.js))
Evita mensagens soltas em texto puro na tela. Todos os avisos da plataforma utilizam um contêiner flutuante moderno, com ícone vetorial temático, barra de progresso de tempo, pausa no hover e dismiss manual:

```javascript
useAlert.sucesso('Pedido enviado para a cozinha!', 'Sucesso');
useAlert.aviso('O estoque deste produto está baixo.', 'Atenção');
useAlert.erro('Credenciais inválidas. Verifique seu e-mail.', 'Erro');
useAlert.info('Novos pedidos recebidos em tempo real.', 'Informativo');
```

### 7.2. Cliente de API ([`useApi.js`](file:///c:/xampp/htdocs/liq/utils/functions/useApi.js))
Cliente assíncrono universal que encapsula a `fetch` API, injetando cabeçalhos de segurança, `credentials: 'include'` para cookies seguros através de subdomínios e tratamento centralizado de exceções:

```javascript
const menuData = await useApi.get('/menu?restaurant=cafe-central');
const loginRes = await useApi.post('/auth/login', { email, password });
const updateRes = await useApi.patch(`/orders/${orderId}/status`, { status: 'PREPARING' });
```

### 7.3. Biblioteca de Ícones Vetoriais ([`icons.js`](file:///c:/xampp/htdocs/liq/assets/script/icons.js))
Garante estritamente **zero emojis** na plataforma. Elementos com `data-icon="nome"` são convertidos dinamicamente em SVGs vetoriais puros:

```html
<span data-icon="check" data-icon-size="16"></span>
<span data-icon="utensils" data-icon-size="20"></span>
<span data-icon="shield" data-icon-size="24"></span>
```

---

## 8. Guia de Instalação e Execução Local

### Requisitos Mínimos
- **Servidor Web**: Apache 2.4+ com os módulos `mod_rewrite` e `mod_headers` habilitados.
- **Banco de Dados**: MySQL 5.7+ ou MariaDB 10.3+.
- **PHP**: Versão 8.0 ou superior (com extensões `pdo_mysql`, `json`, `mbstring`).

### Passo a Passo

1. **Clonar ou posicionar o projeto na raiz do servidor web**:
   ```powershell
   # Exemplo no ambiente XAMPP para Windows:
   C:\xampp\htdocs\liq
   ```

2. **Configurar as Variáveis de Ambiente**:
   Verifique o arquivo [`api/.env`](file:///c:/xampp/htdocs/liq/api/.env) e configure as credenciais do banco de dados local:
   ```ini
   APP_ENV=development
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_NAME=liq_saas
   DB_USER=root
   DB_PASS=
   ```

3. **Executar a Migração do Banco de Dados**:
   Abra o terminal e execute o script de migração:
   ```bash
   php api/database/migrate.php
   ```
   *O script criará o banco `liq_saas` e todas as 17 tabelas relacionais com dados de demonstração.*

4. **Acessar a Plataforma no Navegador**:
   - **Landing Page**: `http://localhost/liq/index.html`
   - **Login do Restaurante**: `http://localhost/liq/auth/login/index.html`
   - **Cadastro de Restaurante**: `http://localhost/liq/auth/register/index.html`
   - **Plataforma do Restaurante (Dashboard / KDS)**: `http://localhost/liq/user/index.html`
   - **Cardápio Digital na Mesa (Mesa 07)**: `http://localhost/liq/client/index.html?t=07`
   - **Healthcheck da API**: `http://localhost/liq/api/health`

---

## 9. Credenciais Padrão de Demonstração

Para fins de teste e demonstração imediata do sistema:

- **Restaurante de Demonstração**: Café Central (`slug: cafe-central`)
- **Usuário Gestor**: `admin@cafecentral.ao`
- **Senha Padrão**: `admin123`
- **Mesa de Testes**: Mesa 07 (`qr_token: 07`)

---

*LIQ SAAS — Tecnologia Multi-Tenant de Ponta para Restaurantes, Bares e Hotéis.*
