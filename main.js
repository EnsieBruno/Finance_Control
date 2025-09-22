/* --- Configurações e Variáveis Globais --- */
const STORAGE_KEY = 'gastos_simplificado_v4';
const STORAGE_THEME_KEY = 'theme_mode';

let state = {
    gastos: [],
    salarioInicial: 0.00,
    cajuInicial: 0.00
};

let isEditing = false;

/* --- Referências do DOM --- */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const refs = {
    salarioInput: $('#salarioInput'),
    cajuInput: $('#cajuInput'),
    salarioRestanteEl: $('#salarioRestante'),
    cajuRestanteEl: $('#cajuRestante'),
    addForm: $('#addForm'),
    gastosTableBody: $('#gastosTable tbody'),
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
    // Remove "R$", espaços, e troca a vírgula por ponto
    const cleaned = value.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
};

const formatCurrencyInput = (e) => {
    let value = e.target.value;
    value = value.replace(/\D/g, ''); // Remove todos os não-dígitos
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
        if (raw) {
            state = JSON.parse(raw);
        }
    } catch (e) {
        console.error('Erro ao carregar estado do localStorage:', e);
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

    const tdSrc = document.createElement('td');
    tdSrc.innerHTML = `<span class="data-field" data-key="source">${gasto.source}</span>`;
    tr.appendChild(tdSrc);

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
    state.cajuInicial = unformatCurrency(refs.cajuInput.value) || 0;

    let salarioRestante = state.salarioInicial;
    let cajuRestante = state.cajuInicial;

    state.gastos.forEach(gasto => {
        if (gasto.paid) {
            if (gasto.source === 'salario') {
                salarioRestante -= gasto.value;
            } else if (gasto.source === 'caju') {
                cajuRestante -= gasto.value;
            }
        }
    });

    refs.salarioRestanteEl.textContent = fmt(salarioRestante);
    refs.cajuRestanteEl.textContent = fmt(cajuRestante);

    refs.gastosTableBody.innerHTML = '';
    state.gastos.forEach(gasto => refs.gastosTableBody.appendChild(createTableRow(gasto)));

    saveState();
}

function toggleEditMode(enable) {
    isEditing = enable;

    refs.editAllBtn.style.display = enable ? 'none' : 'inline-block';
    refs.saveAllBtn.style.display = enable ? 'inline-block' : 'none';
    refs.cancelEditBtn.style.display = enable ? 'inline-block' : 'none';

    $$('#gastosTable tbody tr').forEach((tr, index) => {
        const gasto = state.gastos[index];
        const tds = tr.querySelectorAll('td');

        // Descrição
        tds[0].innerHTML = enable
            ? `<input type="text" class="edit-mode" data-key="desc" value="${gasto.desc}">`
            : `<span class="data-field" data-key="desc">${gasto.desc}</span>`;

        // Valor
        tds[1].innerHTML = enable
            ? `<input type="text" class="edit-mode money-input" data-key="value" value="${fmt(gasto.value)}">`
            : `<span class="data-field" data-key="value">${fmt(gasto.value)}</span>`;

        // Fonte
        tds[2].innerHTML = enable
            ? `<select class="edit-mode edit-mode-select" data-key="source">
                <option value="salario" ${gasto.source === 'salario' ? 'selected' : ''}>Salário</option>
                <option value="caju" ${gasto.source === 'caju' ? 'selected' : ''}>Caju</option>
              </select>`
            : `<span class="data-field" data-key="source">${gasto.source}</span>`;

        // Habilita/Desabilita checkbox de Pago
        tds[3].querySelector('.status-check').disabled = enable;

        // Esconde/mostra botão Remover
        tds[4].style.display = enable ? 'none' : 'table-cell';
    });

    if (enable) {
        $$('.money-input').forEach(input => {
            input.addEventListener('input', formatCurrencyInput);
        });
    }
}

function saveAllChanges() {
    $$('#gastosTable tbody tr').forEach((tr, index) => {
        const gasto = state.gastos[index];
        const descInput = tr.querySelector('[data-key="desc"]');
        const valueInput = tr.querySelector('[data-key="value"]');
        const sourceSelect = tr.querySelector('[data-key="source"]');

        if (descInput) gasto.desc = descInput.value.trim();
        if (valueInput) gasto.value = unformatCurrency(valueInput.value);
        if (sourceSelect) gasto.source = sourceSelect.value;
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
            source: $('#source').value,
            paid: false
        };
        state.gastos.push(novoGasto);
        refs.addForm.reset();
        render();
    });

    refs.salarioInput.addEventListener('input', render);
    refs.cajuInput.addEventListener('input', render);

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
        render(); // Reverte para o estado original
    });
}

/* --- Inicialização --- */
function init() {
    loadState();

    refs.salarioInput.value = fmt(state.salarioInicial);
    refs.cajuInput.value = fmt(state.cajuInicial);

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