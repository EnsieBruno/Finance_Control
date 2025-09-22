/* --- Configurações e Variáveis Globais --- */
const STORAGE_KEY = 'gastos_simplificado_v6';
const OLD_STORAGE_KEY = 'gastos_simplificado_v5';
const STORAGE_THEME_KEY = 'theme_mode';

let state = {
    gastos: [],
    salarioInicial: 0.00,
    valeInicial: 0.00
};

let isEditing = false;

/* --- Referências do DOM --- */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const refs = {
    salarioInput: $('#salarioInput'),
    valeInput: $('#valeInput'),
    salarioRestanteEl: $('#salarioRestante'),
    valeRestanteEl: $('#valeRestante'),
    addForm: $('#addForm'),
    salarioTableBody: $('#salarioTable tbody'),
    valeTableBody: $('#valeTable tbody'),
    btnClear: $('#btnClear'),
    lastSavedEl: $('#lastSaved'),
    themeToggle: $('#themeToggle'),
    editAllBtn: $('#editAllBtn'),
    saveAllBtn: $('#saveAllBtn'),
    cancelEditBtn: $('#cancelEditBtn')
};

/* --- Funções Auxiliares --- */
const fmt = v => {
    if (isNaN(v)) v = 0;
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const unformatCurrency = (value) => {
    const cleaned = value.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
};

const formatCurrencyInput = (e) => {
    let value = e.target.value;
    value = value.replace(/\D/g, '');
    if (value) {
        value = (parseInt(value, 10) / 100).toFixed(2);
        value = value.replace('.', ',');
        value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        e.target.value = `R$ ${value}`;
    } else {
        e.target.value = 'R$ 0,00';
    }
};

/* --- Persistência de Dados --- */
function saveState() {
    try {
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
            // Migração de dados da versão anterior
            const oldState = JSON.parse(oldRaw);
            state.salarioInicial = oldState.salarioInicial;
            state.valeInicial = oldState.valeInicial;
            
            // Remove o campo 'outrosAdicionais' dos gastos se ele existir.
            state.gastos = oldState.gastos.map(gasto => {
                delete gasto.outrosAdicionais;
                return gasto;
            });

            // Se houver dados de adicionais na versão antiga, some ao salário
            if (oldState.outrosAdicionais) {
                state.salarioInicial += oldState.outrosAdicionais;
            }

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

    const tdDesc = document.createElement('td');
    tdDesc.innerHTML = `<span class="data-field" data-key="desc">${gasto.desc}</span>`;
    tr.appendChild(tdDesc);

    const tdVal = document.createElement('td');
    tdVal.innerHTML = `<span class="data-field" data-key="value">${fmt(gasto.value)}</span>`;
    tr.appendChild(tdVal);

    const tdType = document.createElement('td');
    tdType.innerHTML = `<span class="data-field" data-key="type">${gasto.type}</span>`;
    tr.appendChild(tdType);

    const tdDueDay = document.createElement('td');
    tdDueDay.innerHTML = `<span class="data-field" data-key="dueDay">${gasto.dueDay || '-'}</span>`;
    tr.appendChild(tdDueDay);

    const tdPaid = document.createElement('td');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'status-check';
    chk.checked = gasto.paid;
    chk.addEventListener('change', () => {
        gasto.paid = chk.checked;
        saveState();
        render();
    });
    tdPaid.appendChild(chk);
    tr.appendChild(tdPaid);

    const tdActions = document.createElement('td');
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn danger-ghost small';
    btnDelete.textContent = 'Remover';
    btnDelete.addEventListener('click', () => {
        if (confirm(`Remover "${gasto.desc}"?`)) {
            state.gastos = state.gastos.filter(x => x.id !== gasto.id);
            saveState();
            render();
        }
    });
    tdActions.appendChild(btnDelete);
    tr.appendChild(tdActions);

    return tr;
}

function render() {
    state.salarioInicial = unformatCurrency(refs.salarioInput.value) || 0;
    state.valeInicial = unformatCurrency(refs.valeInput.value) || 0;

    let salarioRestante = state.salarioInicial;
    let valeRestante = state.valeInicial;

    state.gastos.forEach(gasto => {
        if (gasto.paid) {
            if (gasto.source === 'salario') {
                salarioRestante -= gasto.value;
            } else if (gasto.source === 'vale') {
                valeRestante -= gasto.value;
            }
        }
    });

    refs.salarioRestanteEl.textContent = fmt(salarioRestante);
    refs.valeRestanteEl.textContent = fmt(valeRestante);

    const gastosSalario = state.gastos.filter(g => g.source === 'salario');
    const gastosVale = state.gastos.filter(g => g.source === 'vale');

    gastosSalario.sort((a, b) => (a.type === 'fixo' ? -1 : 1));
    gastosVale.sort((a, b) => (a.type === 'fixo' ? -1 : 1));

    refs.salarioTableBody.innerHTML = '';
    gastosSalario.forEach(gasto => refs.salarioTableBody.appendChild(createTableRow(gasto)));

    refs.valeTableBody.innerHTML = '';
    gastosVale.forEach(gasto => refs.valeTableBody.appendChild(createTableRow(gasto)));

    saveState();
}

function toggleEditMode(enable) {
    isEditing = enable;

    refs.editAllBtn.style.display = enable ? 'none' : 'inline-block';
    refs.saveAllBtn.style.display = enable ? 'inline-block' : 'none';
    refs.cancelEditBtn.style.display = enable ? 'inline-block' : 'none';
    refs.btnClear.style.display = enable ? 'none' : 'inline-block';

    const allGastos = $$('#salarioTable tbody tr, #valeTable tbody tr');
    allGastos.forEach((tr) => {
        const gasto = state.gastos.find(g => g.id === tr.dataset.id);
        const tds = tr.querySelectorAll('td');

        tds[0].innerHTML = enable
            ? `<input type="text" class="edit-mode" data-key="desc" value="${gasto.desc}">`
            : `<span class="data-field" data-key="desc">${gasto.desc}</span>`;

        tds[1].innerHTML = enable
            ? `<input type="text" class="edit-mode money-input" data-key="value" value="${fmt(gasto.value)}">`
            : `<span class="data-field" data-key="value">${fmt(gasto.value)}</span>`;

        tds[2].innerHTML = enable
            ? `<select class="edit-mode edit-mode-select" data-key="type">
                <option value="fixo" ${gasto.type === 'fixo' ? 'selected' : ''}>Fixo</option>
                <option value="variavel" ${gasto.type === 'variavel' ? 'selected' : ''}>Variável</option>
              </select>`
            : `<span class="data-field" data-key="type">${gasto.type}</span>`;

        tds[3].innerHTML = enable
            ? `<input type="number" min="1" max="31" class="edit-mode" data-key="dueDay" value="${gasto.dueDay}">`
            : `<span class="data-field" data-key="dueDay">${gasto.dueDay || '-'}</span>`;

        tds[4].querySelector('.status-check').disabled = enable;

        tds[5].style.display = enable ? 'none' : 'table-cell';
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
        const descInput = tr.querySelector('[data-key="desc"]');
        const valueInput = tr.querySelector('[data-key="value"]');
        const typeSelect = tr.querySelector('[data-key="type"]');
        const dueDayInput = tr.querySelector('[data-key="dueDay"]');

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
        render();
    });

    refs.salarioInput.addEventListener('input', render);
    refs.valeInput.addEventListener('input', render);

    const moneyInputs = document.querySelectorAll('.money-input, .balance-input');
    moneyInputs.forEach(input => {
        input.addEventListener('input', formatCurrencyInput);
    });

    refs.btnClear.addEventListener('click', () => {
        if (confirm('Atenção! Esta ação irá apagar todos os gastos e saldos. Deseja continuar?')) {
            localStorage.removeItem(STORAGE_KEY);
            location.reload();
        }
    });

    refs.themeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark-mode');
        const isDarkMode = document.documentElement.classList.contains('dark-mode');
        localStorage.setItem(STORAGE_THEME_KEY, isDarkMode ? 'dark' : 'light');
        refs.themeToggle.querySelector('#theme-icon').textContent = isDarkMode ? '☀️' : '🌙';
    });

    // Botões de edição
    refs.editAllBtn.addEventListener('click', () => toggleEditMode(true));
    refs.saveAllBtn.addEventListener('click', saveAllChanges);
    refs.cancelEditBtn.addEventListener('click', () => {
        toggleEditMode(false);
        render();
    });
}

/* --- Inicialização --- */
function init() {
    loadState();
    
    refs.salarioInput.value = fmt(state.salarioInicial);
    refs.valeInput.value = fmt(state.valeInicial);

    const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark-mode');
        refs.themeToggle.querySelector('#theme-icon').textContent = '☀️';
    } else {
        document.documentElement.classList.remove('dark-mode');
        refs.themeToggle.querySelector('#theme-icon').textContent = '🌙';
    }

    setupEventListeners();
    render();
}

init();