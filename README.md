# 💰 Controle de Gastos

Um sistema simples e elegante para controle de gastos pessoais, focado em alta usabilidade e persistência de dados local (via `localStorage`). Ideal para gerenciar diferentes fontes de renda (Salário e Vale/Benefício) e manter o saldo final sempre atualizado.

## ✨ Funcionalidades Principais

* **Controle de Saldo Dinâmico:** Gerencie os valores iniciais de **Salário** e **Vale** (Caju, Benefício) em campos editáveis. O **Saldo Final** é calculado em tempo real com base nos valores de entrada e nos gastos marcados como *pagos*.

* **Registro de Despesas:** Adicione novos gastos com:
    * Descrição
    * Valor
    * Tipo (Fixo ou Variável)
    * Fonte (Salário ou Vale)
    * Dia de Vencimento

* **Marcação de Pagamento:** Use checkboxes para marcar despesas como "pagas" e veja o Saldo Final ser atualizado automaticamente.

* **Ações em Lote (Tabela):**
    * **Seleção em Massa:** Selecione múltiplos gastos (individualmente ou via checkbox no cabeçalho) para visualizar o **Total Selecionado** e **Remover** todos de uma vez.
    * **Marcar Todos como Pagos/Não Pagos:** Checkboxes no cabeçalho de cada tabela permitem mudar o status de pagamento de todos os itens daquela fonte.
    * **Edição em Massa:** Utilize o botão "Editar" para transformar as linhas da tabela em campos de formulário, permitindo a edição rápida de múltiplos itens antes de salvar.
    * **Persistência de Dados:** Todos os dados (gastos, saldos iniciais e tema) são salvos de forma segura no `localStorage` do navegador.
    * **Modo Escuro:** Alternância de tema para uma visualização mais confortável, com o tema preferido sendo salvo.
    * **Limpar Tudo:** Um botão de segurança para apagar todos os dados e começar do zero.

## 🛠️ Tecnologias

O projeto é uma Single Page Application (SPA) minimalista, construída com tecnologias web puras, garantindo leveza e rapidez.

* **HTML:** Estrutura semântica da aplicação.
* **CSS:** Estilização moderna, responsiva, com uso de [CSS Variables](https://developer.mozilla.org/pt-BR/docs/Web/CSS/Using_CSS_custom_properties) para o suporte ao **Modo Escuro**.
* **JavaScript (main.js):** Toda a lógica de estado, manipulação do DOM, formatação de moeda, persistência (`localStorage`) e tratamento de eventos.

## 🚀 Como Usar

Não é necessária nenhuma instalação ou configuração complexa!

1.  **Clone o Repositório:**
    ```bash
    git clone https://github.com/EnsieBruno/Finance_Control.git
    ```
2.  **Abra o `index.html`:**
    Basta dar um duplo clique no arquivo `index.html` e ele abrirá em seu navegador web preferido.
3.  **Comece a Gerenciar:**
    * Insira seus saldos iniciais de Salário e Vale.
    * Clique no botão flutuante **"+ Adicionar Conta"** para registrar suas despesas.
    * Marque os itens como pagos e acompanhe o Saldo Final.

---

*Direitos reservados ao Bruno Alves da Silva 2025, permitido cópias.*

*Projeto de teste, sem fins lucrativos.*