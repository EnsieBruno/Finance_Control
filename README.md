# 💰 Controle de Gastos (Full-Stack)

Um sistema web completo para controle de gastos pessoais, focado em alta usabilidade. Esta versão utiliza **Supabase** como backend, permitindo autenticação de usuários e persistência de dados na nuvem.

## ✨ Funcionalidades Principais

Este projeto evoluiu de uma simples SPA para uma aplicação full-stack com os seguintes recursos:

* **Autenticação de Usuários:**
    * Sistema completo de **Login**, **Cadastro** e **Recuperação de Senha** (via e-mail).
    * Os dados de cada usuário são privados e vinculados à sua conta.

* **Persistência na Nuvem (Supabase):**
    * Todos os gastos, saldos de Salário e Vale são salvos em um banco de dados PostgreSQL na nuvem.
    * Os dados são carregados automaticamente ao fazer login.

* **Resumo Financeiro Dinâmico:**
    * Gerencie os valores iniciais de **Salário** e **Vale** em campos editáveis (com *debounce* para salvar automaticamente).
    * O **Saldo Final** é calculado em tempo real com base nos valores de entrada e nos gastos marcados como *pagos*.

* **Gerenciamento de Contas (CRUD):**
    * Adicione novas contas de despesa através de um formulário flutuante.
    * As contas são separadas em duas tabelas: "Contas Salário" e "Contas Vale".
    * Remova contas individualmente.

* **Ações em Lote e Edição:**
    * **Modo de Edição:** Clique em "Editar" para transformar todas as linhas da tabela em campos de formulário, permitindo a edição rápida de múltiplos itens antes de "Salvar".
    * **Seleção Múltipla:** Selecione vários gastos para ver o **Total Selecionado** e **Remover em Lote**.
    * **Marcar em Massa:** Marque/desmarque todos os itens de uma tabela como pagos/não pagos com um único clique no cabeçalho.

* **Importação e Exportação de CSV:**
    * Exporte todos os seus gastos para um arquivo `.csv`.
    * Importe gastos de um arquivo `.csv` (requer colunas compatíveis).

* **Gerenciamento de Conta:**
    * Página "Minha Conta" para atualizar e-mail e senha com segurança (exige confirmação da senha atual).

* **Design e UX:**
    * **Modo Escuro (Dark Mode):** Alternância de tema com persistência no `localStorage`.
    * **Totalmente Responsivo:** Interface adaptada para uso confortável em desktops e dispositivos móveis (com linhas de tabela expansíveis).
    * **Feedback Visual:** Mensagens de sucesso e erro em todas as ações.

## 🛠️ Tecnologias

* **Frontend:**
    * **HTML5:** Estrutura semântica.
    * **CSS3:** Estilização moderna (Flexbox, Grid), Variáveis CSS (para *theming*) e Media Queries (para responsividade).
    * **JavaScript (ES6+):** Manipulação do DOM, lógica de estado, chamadas de API (async/await) e tratamento de eventos.

* **Backend (BaaS - Backend as a Service):**
    * **Supabase:**
        * **Autenticação:** Gerenciamento de usuários.
        * **Banco de Dados:** Armazenamento de dados em tabelas PostgreSQL (`profiles` e `gastos`).

* **Bibliotecas Externas:**
    * **`@supabase/supabase-js`:** Cliente oficial para interagir com o Supabase.
    * **`PapaParse`:** Para análise (parsing) e geração de arquivos CSV.

## 🚀 Como Executar o Projeto

Diferente de um projeto estático, este requer configuração de um backend Supabase para funcionar.

5. Executar a Aplicação
Após configurar o Supabase, basta abrir o arquivo index.html no seu navegador. Você pode usar um servidor local (como a extensão "Live Server" do VS Code) ou simplesmente abrir o arquivo diretamente.

Direitos reservados ao Bruno Alves da Silva 2025, permitido cópias.

Projeto de teste, sem fins lucrativos.