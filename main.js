/* --- Configurações e Variáveis Globais --- */
const STORAGE_KEY = 'gastos_simplificado_v7_refatorado'; // Alterada para v7 para evitar conflito com a v6
const OLD_STORAGE_KEY = 'gastos_simplificado_v6';
const STORAGE_THEME_KEY = 'theme_mode';

let state = {
    gastos: [],
    salarioInicial: 0.00,
    valeInicial: 0.00
};

let isEditing = false;
let selectedGastosIds = []; // NOVO: Array para rastrear os IDs dos gastos selecionados

/* --- Referências do DOM --- */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const refs = {
    salarioInput: $('#salarioInput'),
    valeInput: $('#valeInput'),
    saldoFinalEl: $('#saldoFinal'),
    addForm: $('#addForm'),
    salarioTableBody: $('#salarioTable tbody'),
    valeTableBody: $('#valeTable tbody'),
    btnClear: $('#btnClear'),
    lastSavedEl: $('#lastSaved'),
    themeToggle: $('#themeToggle'),
    editAllBtn: $('#editAllBtn'),
    saveAllBtn: $('#saveAllBtn'),
    cancelEditBtn: $('#cancelEditBtn'),
    openAddFormBtn: $('#openAddFormBtn'), 
    closeAddFormBtn: $('#closeAddFormBtn'), 
    addFormCard: $('#addFormCard'),
    // NOVOS: Referências para o totalizador e remoção em massa
    selectionActions: $('#selectionActions'),
    selectedTotalEl: $('#selectedTotal'),
    selectedCountEl: $('#selectedCount'),
    removeSelectedBtn: $('#removeSelectedBtn'),
};

/* --- Funções Auxiliares --- */
const fmt = v => {
    if (isNaN(v)) v = 0;
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const unformatCurrency = (value) => {
    // Remove R$, espaços, e converte para formato decimal (ponto)
    const cleaned = value.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
};

const formatCurrencyInput = (e) => {
    let value = e.target.value;
    value = value.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '');
    
    if (value) {
        value = (parseInt(value, 10) / 100).toFixed(2);
        value = value.replace('.', ',');
        value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        e.target.value = `R$ ${value}`;
    } else {
        e.target.value = ''; // Limpa se o valor for zero/vazio
    }
};

/* --- Persistência de Dados --- */
function saveState() {
    try {
        // Atualiza os valores de entrada antes de salvar
        state.salarioInicial = unformatCurrency(refs.salarioInput.value) || 0;
        state.valeInicial = unformatCurrency(refs.valeInput.value) || 0;
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        refs.lastSavedEl.textContent = new Date().toLocaleString('pt-BR');
    } catch (e) {
        console.error('Erro ao salvar no localStorage:', e);
    }
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);

        if (raw) {
            state = JSON.parse(raw);
        } else if (oldRaw) {
            // Migração de dados da versão anterior (v6)
            const oldState = JSON.parse(oldRaw);
            state.salarioInicial = oldState.salarioInicial || 0.00;
            state.valeInicial = oldState.valeInicial || 0.00;
            
            // Assume que todos os gastos da v6 já estão no formato esperado
            state.gastos = oldState.gastos || [];

            // Remove o estado antigo para não migrar novamente
            localStorage.removeItem(OLD_STORAGE_KEY);
            console.log("Dados migrados da versão anterior com sucesso!");
        }
    } catch (e) {
        console.error('Erro ao carregar ou migrar estado do localStorage:', e);
    }
}

/* --- Renderização da Interface --- */
function createTableRow(gasto) {
    const tr = document.createElement('tr');
    tr.dataset.id = gasto.id;

    // NOVO: Checkbox de Seleção
    const tdSelect = document.createElement('td');
    const chkSelect = document.createElement('input');
    chkSelect.type = 'checkbox';
    chkSelect.className = 'select-check';
    chkSelect.checked = selectedGastosIds.includes(gasto.id); // Sincroniza com o estado
    chkSelect.disabled = isEditing; // Desabilita na edição em massa
    chkSelect.addEventListener('change', () => {
        if (chkSelect.checked) {
            if (!selectedGastosIds.includes(gasto.id)) {
                selectedGastosIds.push(gasto.id);
            }
        } else {
            selectedGastosIds = selectedGastosIds.filter(id => id !== gasto.id);
        }
        updateSelectionTotal(); // ATUALIZA O TOTALIZADOR
    });
    tdSelect.appendChild(chkSelect);
    tr.appendChild(tdSelect); 

    const tdDesc = document.createElement('td');
    tdDesc.innerHTML = `<span class="data-field" data-key="desc">${gasto.desc}</span>`;
    tr.appendChild(tdDesc);

    const tdVal = document.createElement('td');
    tdVal.innerHTML = `<span class="data-field" data-key="value">${fmt(gasto.value)}</span>`;
    tr.appendChild(tdVal);

    const tdType = document.createElement('td');
    tdType.innerHTML = `<span class="data-field" data-key="type">${gasto.type === 'fixo' ? 'Fixo' : 'Variável'}</span>`;
    tr.appendChild(tdType);

    const tdDueDay = document.createElement('td');
    tdDueDay.innerHTML = `<span class="data-field" data-key="dueDay">${gasto.dueDay || '-'}</span>`;
    tr.appendChild(tdDueDay);

    const tdPaid = document.createElement('td');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'status-check';
    chk.checked = gasto.paid;
    chk.disabled = isEditing; // Desabilita na edição em massa
    chk.addEventListener('change', () => {
        gasto.paid = chk.checked;
        saveState();
        render(); // Re-renderiza para atualizar o Saldo Final
    });
    tdPaid.appendChild(chk);
    tr.appendChild(tdPaid);

    const tdActions = document.createElement('td');
    tdActions.className = 'actions-cell';
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn danger-ghost small';
    btnDelete.textContent = 'Remover';
    btnDelete.style.display = isEditing ? 'none' : 'inline-block'; // Esconde na edição em massa
    btnDelete.addEventListener('click', () => {
        if (confirm(`Remover "${gasto.desc}"?`)) {
            state.gastos = state.gastos.filter(x => x.id !== gasto.id);
            // Garante que o ID seja removido se estiver selecionado
            selectedGastosIds = selectedGastosIds.filter(id => id !== gasto.id); 
            saveState();
            render();
        }
    });
    tdActions.appendChild(btnDelete);
    tr.appendChild(tdActions);

    return tr;
}

function render() {
    // 1. Atualiza o estado das entradas a partir dos inputs (Importante para o saveState e cálculos)
    state.salarioInicial = unformatCurrency(refs.salarioInput.value) || 0;
    state.valeInicial = unformatCurrency(refs.valeInput.value) || 0;

    // 2. Cálculo do Saldo Final (Entradas Totais - Gastos PAGOS)
    const entradasTotais = state.salarioInicial + state.valeInicial;
    const gastosPagos = state.gastos
        .filter(g => g.paid)
        .reduce((sum, gasto) => sum + gasto.value, 0);

    const saldoFinal = entradasTotais - gastosPagos;

    refs.saldoFinalEl.textContent = fmt(saldoFinal);
    refs.saldoFinalEl.style.color = saldoFinal >= 0 ? 'var(--purple-main)' : 'var(--red-alert)';

    // 3. Renderização das Tabelas (Mantida a separação por Fonte)
    const gastosSalario = state.gastos.filter(g => g.source === 'salario');
    const gastosVale = state.gastos.filter(g => g.source === 'vale');

    gastosSalario.sort((a, b) => (a.type === 'fixo' ? -1 : 1));
    gastosVale.sort((a, b) => (a.type === 'fixo' ? -1 : 1));

    refs.salarioTableBody.innerHTML = '';
    gastosSalario.forEach(gasto => refs.salarioTableBody.appendChild(createTableRow(gasto)));

    refs.valeTableBody.innerHTML = '';
    gastosVale.forEach(gasto => refs.valeTableBody.appendChild(createTableRow(gasto)));

    // 4. Salva o estado após a renderização
    saveState();
    
    // NOVO: Atualiza o totalizador após a renderização das tabelas
    updateSelectionTotal(); 
}

// NOVO: Função para atualizar o total e a visibilidade da barra flutuante
function updateSelectionTotal() {
    const selectedGastos = state.gastos.filter(g => selectedGastosIds.includes(g.id));
    const total = selectedGastos.reduce((sum, gasto) => sum + gasto.value, 0);
    const count = selectedGastos.length;

    refs.selectedTotalEl.textContent = fmt(total);
    refs.selectedCountEl.textContent = `${count} conta${count !== 1 ? 's' : ''} selecionada${count !== 1 ? 's' : ''}`;
    refs.removeSelectedBtn.textContent = `Remover Selecionada${count !== 1 ? 's' : ''} (${count})`;

    if (count > 0 && !isEditing) { // Oculta a barra durante a edição em massa
        refs.selectionActions.classList.remove('hidden');
    } else {
        refs.selectionActions.classList.add('hidden');
    }
}

// NOVO: Função para remover os gastos selecionados
function removeSelectedGastos() {
    if (selectedGastosIds.length === 0) return;

    if (confirm(`Tem certeza que deseja remover ${selectedGastosIds.length} conta(s) selecionada(s)?`)) {
        state.gastos = state.gastos.filter(g => !selectedGastosIds.includes(g.id));
        selectedGastosIds = []; // Limpa a seleção
        saveState();
        render(); // Re-renderiza tudo
    }
}

// Lógica de Edição em Massa (Refatorada para o novo layout e para a nova coluna)
function toggleEditMode(enable) {
    isEditing = enable;

    refs.editAllBtn.style.display = enable ? 'none' : 'inline-block';
    refs.saveAllBtn.style.display = enable ? 'inline-block' : 'none';
    refs.cancelEditBtn.style.display = enable ? 'inline-block' : 'none';
    refs.btnClear.style.display = enable ? 'none' : 'inline-block';
    refs.openAddFormBtn.style.display = enable ? 'none' : 'block'; // Esconde o botão flutuante na edição
    refs.selectionActions.classList.add('hidden'); // Oculta a barra de seleção na edição

    const allGastos = $$('#salarioTable tbody tr, #valeTable tbody tr');
    allGastos.forEach((tr) => {
        const gasto = state.gastos.find(g => g.id === tr.dataset.id);
        const tds = tr.querySelectorAll('td');
        
        // NOVO: Coluna Sel. (tds[0])
        tds[0].querySelector('.select-check').disabled = enable;

        // Descrição (tds[1])
        tds[1].innerHTML = enable
            ? `<input type="text" class="edit-mode" data-key="desc" value="${gasto.desc}">`
            : `<span class="data-field" data-key="desc">${gasto.desc}</span>`;

        // Valor (tds[2])
        tds[2].innerHTML = enable
            ? `<input type="text" class="edit-mode money-input" data-key="value" value="${fmt(gasto.value)}">`
            : `<span class="data-field" data-key="value">${fmt(gasto.value)}</span>`;

        // Tipo (tds[3])
        tds[3].innerHTML = enable
            ? `<select class="edit-mode edit-mode-select" data-key="type">
                <option value="fixo" ${gasto.type === 'fixo' ? 'selected' : ''}>Fixo</option>
                <option value="variavel" ${gasto.type === 'variavel' ? 'selected' : ''}>Variável</option>
              </select>`
            : `<span class="data-field" data-key="type">${gasto.type === 'fixo' ? 'Fixo' : 'Variável'}</span>`;

        // Vencimento (tds[4])
        tds[4].innerHTML = enable
            ? `<input type="number" min="1" max="31" class="edit-mode" data-key="dueDay" value="${gasto.dueDay || ''}">`
            : `<span class="data-field" data-key="dueDay">${gasto.dueDay || '-'}</span>`;

        // Paid Checkbox (tds[5])
        tds[5].querySelector('.status-check').disabled = enable;

        // Ações (tds[6]) - O botão 'Remover' já é tratado em createTableRow
        tds[6].style.display = enable ? 'none' : 'table-cell';
    });

    if (enable) {
        $$('.money-input').forEach(input => {
            input.addEventListener('input', formatCurrencyInput);
        });
    }
}

function saveAllChanges() {
    const allGastos = $$('#salarioTable tbody tr, #valeTable tbody tr');
    allGastos.forEach((tr) => {
        const gasto = state.gastos.find(g => g.id === tr.dataset.id);
        // Note que os índices dos TDs mudaram! [1] Desc, [2] Valor, [3] Tipo, [4] Vencimento
        const descInput = tr.querySelectorAll('td')[1].querySelector('[data-key="desc"]');
        const valueInput = tr.querySelectorAll('td')[2].querySelector('[data-key="value"]');
        const typeSelect = tr.querySelectorAll('td')[3].querySelector('[data-key="type"]');
        const dueDayInput = tr.querySelectorAll('td')[4].querySelector('[data-key="dueDay"]');

        if (descInput) gasto.desc = descInput.value.trim();
        if (valueInput) gasto.value = unformatCurrency(valueInput.value);
        if (typeSelect) gasto.type = typeSelect.value;
        if (dueDayInput) gasto.dueDay = dueDayInput.value.trim();
    });
    saveState();
    toggleEditMode(false);
    render();
}


/* --- Lógica de Eventos --- */
function setupEventListeners() {
    // 1. Adicionar Gasto (Lógica do Modal/Floating Card)
    refs.openAddFormBtn.addEventListener('click', () => {
        refs.addFormCard.classList.remove('hidden');
    });

    refs.closeAddFormBtn.addEventListener('click', () => {
        refs.addFormCard.classList.add('hidden');
    });

    refs.addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const novoGasto = {
            id: uid(),
            desc: $('#desc').value.trim(),
            value: unformatCurrency($('#value').value),
            type: $('#type').value,
            source: $('#source').value,
            dueDay: $('#due-day').value.trim(),
            paid: false
        };
        state.gastos.push(novoGasto);
        refs.addForm.reset();
        refs.addFormCard.classList.add('hidden'); // Fecha o modal após salvar
        render();
    });

    // 2. Entradas (Salário/Vale) - Disparam renderização no 'input'
    refs.salarioInput.addEventListener('input', render);
    refs.valeInput.addEventListener('input', render);
    
    // 3. Formatação de Moeda
    const moneyInputs = document.querySelectorAll('.money-input, .balance-input');
    moneyInputs.forEach(input => {
        input.addEventListener('input', formatCurrencyInput);
        
        // Adiciona um listener blur para formatar R$ 0,00 se ficar vazio
        input.addEventListener('blur', (e) => {
            if (e.target.value.trim() === '' || unformatCurrency(e.target.value) === 0) {
                 e.target.value = ''; // Mantém vazio ou seta para 0
                 render();
            }
        });
    });

    // 4. Limpar Tudo
    refs.btnClear.addEventListener('click', () => {
        if (confirm('Atenção! Esta ação irá apagar todos os gastos e saldos. Deseja continuar?')) {
            localStorage.removeItem(STORAGE_KEY);
            // Também remove a chave antiga, caso o usuário esteja na fase de migração/teste
            localStorage.removeItem(OLD_STORAGE_KEY); 
            location.reload();
        }
    });

    // 5. Toggle Tema
    refs.themeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark-mode');
        const isDarkMode = document.documentElement.classList.contains('dark-mode');
        localStorage.setItem(STORAGE_THEME_KEY, isDarkMode ? 'dark' : 'light');
        refs.themeToggle.querySelector('#theme-icon').textContent = isDarkMode ? '☀️' : '🌙';
    });

    // 6. Botões de edição
    refs.editAllBtn.addEventListener('click', () => toggleEditMode(true));
    refs.saveAllBtn.addEventListener('click', saveAllChanges);
    refs.cancelEditBtn.addEventListener('click', () => {
        toggleEditMode(false);
        render(); // Reverte e re-renderiza
    });
    
    // NOVO: Lógica de Remoção em Massa
    refs.removeSelectedBtn.addEventListener('click', removeSelectedGastos);
}

/* --- Inicialização --- */
function init() {
    loadState();
    
    // Seta os valores iniciais formatados nos inputs
    refs.salarioInput.value = state.salarioInicial > 0 ? fmt(state.salarioInicial) : '';
    refs.valeInput.value = state.valeInicial > 0 ? fmt(state.valeInicial) : '';

    // Configura o tema
    const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark-mode');
        refs.themeToggle.querySelector('#theme-icon').textContent = '☀️';
    } else {
        document.documentElement.classList.remove('dark-mode');
        refs.themeToggle.querySelector('#theme-icon').textContent = '🌙';
    }

    setupEventListeners();
    render(); // Primeira renderização para calcular o saldo e exibir as tabelas
}

init();