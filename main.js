/* --- Configuração do Supabase --- */
// Suas chaves já estão configuradas aqui
const SUPABASE_URL = 'https://edpwhxuefzhvrquvipqd.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcHdoeHVlZnpodnJxdXZpcHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNDkyOTgsImV4cCI6MjA3NjkyNTI5OH0.VYi3KLQVpXSJctdbIwkbAc3WqBgmYI3DQLLBPn0fnG8';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);


/* --- Configurações e Variáveis Globais --- */
const STORAGE_THEME_KEY = 'theme_mode';
let currentUser = null; 
let isLoginMode = true; // Controla se o formulário está em modo Login ou Cadastro

let state = {
    gastos: [],
    salarioInicial: 0.00,
    valeInicial: 0.00,
    profileLoaded: false 
};

let isEditing = false;
let selectedGastosIds = [];

/* --- Referências do DOM --- */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const refs = {
    // Telas
    authScreen: $('#auth-screen'),
    appContainer: $('#app-container'),
    
    // Auth
    authForm: $('#auth-form'),
    authEmailInput: $('#auth-email'),
    authPasswordInput: $('#auth-password'),
    authSubmitBtn: $('#auth-submit-btn'),
    authToggleLogin: $('#auth-toggle-login'),
    authToggleRegister: $('#auth-toggle-register'),
    authTitle: $('#auth-title'),
    authSubtitle: $('#auth-subtitle'),
    authMessage: $('#auth-message'),
    
    // App
    logoutBtn: $('#logout-btn'),
    userInfo: $('#user-info'),
    userAvatar: $('#user-avatar'),
    userEmail: $('#user-email'),
    salarioInput: $('#salarioInput'),
    valeInput: $('#valeInput'),
    saldoFinalEl: $('#saldoFinal'),
    addForm: $('#addForm'),
    salarioTableBody: $('#salarioTable tbody'),
    valeTableBody: $('#valeTable tbody'),
    btnClear: $('#btnClear'),
    themeToggle: $('#themeToggle'),
    editAllBtn: $('#editAllBtn'),
    saveAllBtn: $('#saveAllBtn'),
    cancelEditBtn: $('#cancelEditBtn'),
    openAddFormBtn: $('#openAddFormBtn'), 
    closeAddFormBtn: $('#closeAddFormBtn'), 
    addFormCard: $('#addFormCard'),
    selectionActions: $('#selectionActions'),
    selectedTotalEl: $('#selectedTotal'),
    selectedCountEl: $('#selectedCount'),
    removeSelectedBtn: $('#removeSelectedBtn'),
    selectAllSalario: $('#selectAllSalario'),
    markPaidAllSalario: $('#markPaidAllSalario'),
    selectAllVale: $('#selectAllVale'),
    markPaidAllVale: $('#markPaidAllVale'),
};

/* --- Funções Auxiliares --- */
const fmt = v => {
    if (isNaN(v)) v = 0;
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const unformatCurrency = (value) => {
    const cleaned = String(value).replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
};

const formatCurrencyInput = (e) => {
    let value = e.target.value;
    value = value.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '');
    
    if (value && !isNaN(value)) {
        value = (parseInt(value, 10) / 100).toFixed(2);
        value = value.replace('.', ',');
        
        // Regex para adicionar ponto de milhar
        value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        if (value.startsWith('.')) {
            value = value.substring(1);
        }
        e.target.value = `R$ ${value}`;
    } else {
        e.target.value = ''; 
    }
};

let saveProfileTimeout;
const debouncedSaveProfile = () => {
    clearTimeout(saveProfileTimeout);
    saveProfileTimeout = setTimeout(saveProfileData, 1000); 
};


/* --- Lógica de Banco de Dados (Supabase) --- */

async function loadInitialData() {
    if (!currentUser) return;
    console.log("Carregando dados do usuário:", currentUser.id);
    
    try {
        const { data: profileData, error: profileError } = await supabaseClient
            .from('profiles')
            .upsert({ id: currentUser.id, updated_at: new Date().toISOString() })
            .select()
            .single();

        if (profileError && profileError.code !== '23505') { 
             console.error('Erro ao carregar/criar perfil:', profileError);
        } else if (profileData) {
            state.salarioInicial = profileData.salario_inicial || 0;
            state.valeInicial = profileData.vale_inicial || 0;
            state.profileLoaded = true;
            refs.salarioInput.value = state.salarioInicial > 0 ? fmt(state.salarioInicial) : '';
            refs.valeInput.value = state.valeInicial > 0 ? fmt(state.valeInicial) : '';
        }

        const { data: gastosData, error: gastosError } = await supabaseClient
            .from('gastos')
            .select('*')
            .eq('user_id', currentUser.id);

        if (gastosError) {
            console.error('Erro ao carregar gastos:', gastosError);
        } else {
            state.gastos = gastosData.map(g => ({
                ...g,
                dueDay: g.due_day ? parseInt(g.due_day, 10) : null
            })) || [];
        }
        
    } catch (error) {
        console.error("Erro geral ao carregar dados:", error);
    } finally {
        render(); 
    }
}

async function saveProfileData() {
    if (!currentUser || !state.profileLoaded) return;
    
    const newSalario = unformatCurrency(refs.salarioInput.value);
    const newVale = unformatCurrency(refs.valeInput.value);
    
    if (newSalario === state.salarioInicial && newVale === state.valeInicial) {
        return; 
    }

    state.salarioInicial = newSalario;
    state.valeInicial = newVale;

    console.log("Salvando perfil...", { newSalario, newVale });
    
    const { error } = await supabaseClient
        .from('profiles')
        .update({ 
            salario_inicial: state.salarioInicial,
            vale_inicial: state.valeInicial,
            updated_at: new Date().toISOString() 
        })
        .eq('id', currentUser.id);
    
    if (error) {
        console.error("Erro ao salvar perfil:", error);
    } else {
        console.log("Perfil salvo com sucesso.");
        render(); 
    }
}

async function addGasto(gasto) {
    if (!currentUser) return;
    
    const gastoData = {
        user_id: currentUser.id,
        desc: gasto.desc,
        value: gasto.value,
        type: gasto.type,
        source: gasto.source,
        due_day: gasto.dueDay || null, 
        paid: gasto.paid
    };
    
    const { data, error } = await supabaseClient
        .from('gastos')
        .insert(gastoData)
        .select()
        .single();
    
    if (error) {
        console.error("Erro ao adicionar gasto:", error);
    } else {
        console.log("Gasto adicionado:", data);
        state.gastos.push({
            ...data,
            dueDay: data.due_day ? parseInt(data.due_day, 10) : null
        });
        render();
    }
}

async function updateGasto(gastoId, updates) {
    const dbUpdates = {};
    if (updates.hasOwnProperty('desc')) dbUpdates.desc = updates.desc;
    if (updates.hasOwnProperty('value')) dbUpdates.value = updates.value;
    if (updates.hasOwnProperty('type')) dbUpdates.type = updates.type;
    if (updates.hasOwnProperty('source')) dbUpdates.source = updates.source;
    if (updates.hasOwnProperty('dueDay')) dbUpdates.due_day = updates.dueDay || null;
    if (updates.hasOwnProperty('paid')) dbUpdates.paid = updates.paid;
    
    const { error } = await supabaseClient
        .from('gastos')
        .update(dbUpdates)
        .eq('id', gastoId);
    
    if (error) {
        console.error("Erro ao atualizar gasto:", error);
    } else {
        console.log("Gasto atualizado:", gastoId);
        const index = state.gastos.findIndex(g => g.id === gastoId);
        if (index > -1) {
            Object.assign(state.gastos[index], updates);
            render();
        }
    }
}

async function deleteGasto(gastoId) {
    const { error } = await supabaseClient
        .from('gastos')
        .delete()
        .eq('id', gastoId);

    if (error) {
        console.error("Erro ao remover gasto:", error);
    } else {
        console.log("Gasto removido:", gastoId);
        state.gastos = state.gastos.filter(x => x.id !== gastoId);
        selectedGastosIds = selectedGastosIds.filter(id => id !== gastoId); 
        render();
    }
}

async function deleteSelectedGastos() {
    if (selectedGastosIds.length === 0) return;

    const { error } = await supabaseClient
        .from('gastos')
        .delete()
        .in('id', selectedGastosIds); 

    if (error) {
        console.error("Erro ao remover gastos selecionados:", error);
    } else {
        console.log("Gastos selecionados removidos.");
        state.gastos = state.gastos.filter(g => !selectedGastosIds.includes(g.id));
        selectedGastosIds = []; 
        render();
    }
}

async function clearAllUserData() {
    if (!currentUser) return;
    
    if (!confirm('Atenção! Esta ação irá apagar TODOS os seus gastos e saldos salvos na nuvem. Deseja continuar?')) {
        return;
    }

    try {
        const { error: gastosError } = await supabaseClient
            .from('gastos')
            .delete()
            .eq('user_id', currentUser.id);
        
        if (gastosError) throw gastosError;

        const { error: profileError } = await supabaseClient
            .from('profiles')
            .update({ salario_inicial: 0, vale_inicial: 0 })
            .eq('id', currentUser.id);

        if (profileError) throw profileError;
        
        console.log("Todos os dados do usuário foram limpos.");
        
        state.gastos = [];
        state.salarioInicial = 0;
        state.valeInicial = 0;
        refs.salarioInput.value = '';
        refs.valeInput.value = '';
        render();
        
    } catch (error) {
        console.error("Erro ao limpar dados do usuário:", error.message);
    }
}


/* --- Lógica de Autenticação --- */

function showAuthMessage(message, isError = false) {
    refs.authMessage.textContent = message;
    refs.authMessage.className = isError ? 'error' : 'success';
}

async function handleLogin(email, password) {
    showAuthMessage("Entrando...", false);
    const { error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });
    
    if (error) {
        console.error('Erro no login:', error.message);
        showAuthMessage(error.message, true);
    } else {
        showAuthMessage("", false);
        // Sucesso! O onAuthStateChanged vai lidar com a exibição do app
    }
}

async function handleSignUp(email, password) {
    showAuthMessage("Criando conta...", false);
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
    });

    if (error) {
        console.error('Erro no cadastro:', error.message);
        showAuthMessage(error.message, true);
    } else {
        console.log('Cadastro realizado:', data);
        showAuthMessage("Cadastro realizado! Verifique seu e-mail para confirmar a conta.", false);
    }
}

async function logout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error('Erro ao sair:', error);
    } else {
        currentUser = null;
        state.gastos = [];
        state.salarioInicial = 0;
        state.valeInicial = 0;
        state.profileLoaded = false;
    }
}

function toggleAuthMode(toLogin) {
    isLoginMode = toLogin;
    showAuthMessage("", false); // Limpa mensagens
    
    if (isLoginMode) {
        refs.authTitle.textContent = "Entrar";
        refs.authSubtitle.textContent = "Acesse sua conta para ver seus gastos.";
        refs.authSubmitBtn.textContent = "Entrar";
        refs.authToggleLogin.classList.add('active');
        refs.authToggleRegister.classList.remove('active');
    } else {
        refs.authTitle.textContent = "Cadastrar";
        refs.authSubtitle.textContent = "Crie uma nova conta para salvar seus dados.";
        refs.authSubmitBtn.textContent = "Criar Conta";
        refs.authToggleLogin.classList.remove('active');
        refs.authToggleRegister.classList.add('active');
    }
}

// Listener principal de autenticação
supabaseClient.auth.onAuthStateChanged((event, session) => {
    if (session && session.user) {
        currentUser = session.user;
        console.log('Usuário logado:', currentUser.email);
        
        refs.authScreen.style.display = 'none';
        refs.appContainer.style.display = 'flex';
        
        // Atualiza info do usuário (sem avatar do Google)
        const firstLetter = currentUser.email ? currentUser.email[0].toUpperCase() : 'U';
        refs.userAvatar.src = `https://placehold.co/40x40/11C76F/FFFFFF?text=${firstLetter}`;
        refs.userEmail.textContent = currentUser.email;
        
        loadInitialData();
    } else {
        // Usuário deslogado
        currentUser = null;
        console.log('Usuário deslogado.');
        
        refs.authScreen.style.display = 'flex';
        refs.appContainer.style.display = 'none';
    }
});


/* --- Renderização da Interface (App Principal) --- */

function handleSelectAll(source, isChecked) {
    const sourceGastos = state.gastos.filter(g => g.source === source);
    
    sourceGastos.forEach(gasto => {
        const isSelected = selectedGastosIds.includes(gasto.id);
        if (isChecked && !isSelected) {
            selectedGastosIds.push(gasto.id);
        } else if (!isChecked && isSelected) {
            selectedGastosIds = selectedGastosIds.filter(id => id !== gasto.id);
        }
    });
    render(); 
}

async function handleMarkPaidAll(source, isChecked) {
    const sourceGastos = state.gastos.filter(g => g.source === source);
    
    sourceGastos.forEach(gasto => {
        gasto.paid = isChecked;
    });

    const idsToUpdate = sourceGastos.map(g => g.id);
    if (idsToUpdate.length > 0) {
         const { error } = await supabaseClient
            .from('gastos')
            .update({ paid: isChecked })
            .in('id', idsToUpdate);
        
        if (error) console.error("Erro ao marcar todos como pagos:", error);
    }
    
    render(); 
}

const handleSelectAllSalario = (e) => handleSelectAll('salario', e.target.checked);
const handleMarkPaidAllSalario = (e) => handleMarkPaidAll('salario', e.target.checked);
const handleSelectAllVale = (e) => handleSelectAll('vale', e.target.checked);
const handleMarkPaidAllVale = (e) => handleMarkPaidAll('vale', e.target.checked);

function updateHeaderCheckboxes(source, type) {
    const isSalario = source === 'salario';
    const allChecks = $$(`#${source}Table tbody .${type === 'select' ? 'select-check' : 'status-check'}`);
    const allChecked = Array.from(allChecks).every(chk => chk.checked);
    
    let headerChk, listener;
    
    if (type === 'select') {
        headerChk = isSalario ? refs.selectAllSalario : refs.selectAllVale;
        listener = isSalario ? handleSelectAllSalario : handleSelectAllVale;
    } else {
        headerChk = isSalario ? refs.markPaidAllSalario : refs.markPaidAllVale;
        listener = isSalario ? handleMarkPaidAllSalario : handleMarkPaidAllVale;
    }
    
    headerChk.removeEventListener('change', listener);
    headerChk.checked = allChecks.length > 0 && allChecked;
    headerChk.addEventListener('change', listener);
    headerChk.disabled = allChecks.length === 0 || isEditing;
}

function handleRowClick(event) {
    const interactiveElements = ['INPUT', 'BUTTON', 'SELECT', 'A'];
    if (interactiveElements.includes(event.target.tagName) || 
        event.target.closest('.actions-cell') ||
        event.target.closest('.edit-mode')) {
        return;
    }
    
    const tr = event.currentTarget;
    const isMobile = window.innerWidth <= 550;

    if (isMobile && !isEditing) {
        tr.classList.toggle('expanded');
    }
}

function createTableRow(gasto) {
    const tr = document.createElement('tr');
    tr.dataset.id = gasto.id;
    
    tr.addEventListener('click', handleRowClick);

    // Coluna Sel.
    const tdSelect = document.createElement('td');
    tdSelect.dataset.label = 'Sel.';
    const chkSelect = document.createElement('input');
    chkSelect.type = 'checkbox';
    chkSelect.className = 'select-check';
    chkSelect.checked = selectedGastosIds.includes(gasto.id);
    chkSelect.disabled = isEditing;
    chkSelect.addEventListener('change', () => {
        if (chkSelect.checked) {
            if (!selectedGastosIds.includes(gasto.id)) {
                selectedGastosIds.push(gasto.id);
            }
        } else {
            selectedGastosIds = selectedGastosIds.filter(id => id !== gasto.id);
        }
        updateSelectionTotal(); 
        updateHeaderCheckboxes(gasto.source, 'select'); 
    });
    tdSelect.appendChild(chkSelect);
    tr.appendChild(tdSelect); 

    // Demais colunas
    const tdDesc = document.createElement('td');
    tdDesc.dataset.label = 'Descrição';
    tdDesc.innerHTML = `<span class="data-field" data-key="desc">${gasto.desc}</span>`;
    tr.appendChild(tdDesc);

    const tdVal = document.createElement('td');
    tdVal.dataset.label = 'Valor';
    tdVal.innerHTML = `<span class="data-field" data-key="value">${fmt(gasto.value)}</span>`;
    tr.appendChild(tdVal);

    const tdType = document.createElement('td');
    tdType.dataset.label = 'Tipo';
    tdType.innerHTML = `<span class="data-field" data-key="type">${gasto.type === 'fixo' ? 'Fixo' : 'Variável'}</span>`;
    tr.appendChild(tdType);

    const tdDueDay = document.createElement('td');
    tdDueDay.dataset.label = 'Vencimento';
    tdDueDay.innerHTML = `<span class="data-field" data-key="dueDay">${gasto.dueDay || '-'}</span>`;
    tr.appendChild(tdDueDay);

    // Coluna Pago
    const tdPaid = document.createElement('td');
    tdPaid.dataset.label = 'Pago';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'status-check';
    chk.checked = gasto.paid;
    chk.disabled = isEditing;
    chk.addEventListener('change', () => {
        const newPaidStatus = chk.checked;
        updateGasto(gasto.id, { paid: newPaidStatus }); 
    });
    tdPaid.appendChild(chk);
    tr.appendChild(tdPaid);

    // Coluna Ações
    const tdActions = document.createElement('td');
    tdActions.dataset.label = 'Ação';
    tdActions.className = 'actions-cell';
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn danger-ghost small';
    btnDelete.textContent = 'X';
    btnDelete.style.display = isEditing ? 'none' : 'inline-block';
    btnDelete.addEventListener('click', () => {
        if (confirm(`Remover "${gasto.desc}"?`)) {
            deleteGasto(gasto.id);
        }
    });
    tdActions.appendChild(btnDelete);
    tr.appendChild(tdActions);

    return tr;
}

function render() {
    if (!currentUser) return; 

    const entradasTotais = state.salarioInicial + state.valeInicial;
    const gastosPagos = state.gastos
        .filter(g => g.paid)
        .reduce((sum, gasto) => sum + gasto.value, 0);

    const saldoFinal = entradasTotais - gastosPagos;

    refs.saldoFinalEl.textContent = fmt(saldoFinal);
    refs.saldoFinalEl.style.color = saldoFinal >= 0 ? 'var(--purple-main)' : 'var(--red-alert)';

    const gastosSalario = state.gastos.filter(g => g.source === 'salario');
    const gastosVale = state.gastos.filter(g => g.source === 'vale');

    gastosSalario.sort((a, b) => (a.type === 'fixo' ? -1 : 1));
    gastosVale.sort((a, b) => (a.type === 'fixo' ? -1 : 1));

    refs.salarioTableBody.innerHTML = '';
    gastosSalario.forEach(gasto => refs.salarioTableBody.appendChild(createTableRow(gasto)));

    refs.valeTableBody.innerHTML = '';
    gastosVale.forEach(gasto => refs.valeTableBody.appendChild(createTableRow(gasto)));

    updateHeaderCheckboxes('salario', 'select');
    updateHeaderCheckboxes('salario', 'paid');
    updateHeaderCheckboxes('vale', 'select');
    updateHeaderCheckboxes('vale', 'paid');
    updateSelectionTotal(); 
}

function updateSelectionTotal() {
    const selectedGastos = state.gastos.filter(g => selectedGastosIds.includes(g.id));
    const total = selectedGastos.reduce((sum, gasto) => sum + gasto.value, 0);
    const count = selectedGastos.length;

    refs.selectedTotalEl.textContent = fmt(total);
    refs.selectedCountEl.textContent = `${count} conta${count !== 1 ? 's' : ''} selecionada${count !== 1 ? 's' : ''}`;
    refs.removeSelectedBtn.textContent = `Remover Selecionada${count !== 1 ? 's' : ''} (${count})`;

    if (count > 0 && !isEditing) {
        refs.selectionActions.classList.remove('hidden');
    } else {
        refs.selectionActions.classList.add('hidden');
    }
}

function removeSelectedGastos() {
    if (selectedGastosIds.length === 0) return;

    if (confirm(`Tem certeza que deseja remover ${selectedGastosIds.length} conta(s) selecionada(s)?`)) {
        deleteSelectedGastos(); 
    }
}

function toggleEditMode(enable) {
    isEditing = enable;

    refs.editAllBtn.style.display = enable ? 'none' : 'inline-block';
    refs.saveAllBtn.style.display = enable ? 'inline-block' : 'none';
    refs.cancelEditBtn.style.display = enable ? 'inline-block' : 'none';
    refs.btnClear.style.display = enable ? 'none' : 'inline-block';
    refs.openAddFormBtn.style.display = enable ? 'none' : 'block';
    refs.selectionActions.classList.add('hidden');

    const allGastosRows = $$('#salarioTable tbody tr, #valeTable tbody tr');
    allGastosRows.forEach((tr) => {
        const gasto = state.gastos.find(g => g.id == tr.dataset.id); 
        if (!gasto) return;
        
        const tds = tr.querySelectorAll('td');
        
        tds[0].querySelector('.select-check').disabled = enable;

        tds[1].innerHTML = enable
            ? `<input type="text" class="edit-mode" data-key="desc" value="${gasto.desc}">`
            : `<span class="data-field" data-key="desc">${gasto.desc}</span>`;

        tds[2].innerHTML = enable
            ? `<input type="text" class="edit-mode money-input" data-key="value" value="${fmt(gasto.value)}">`
            : `<span class="data-field" data-key="value">${fmt(gasto.value)}</span>`;

        tds[3].innerHTML = enable
            ? `<select class="edit-mode edit-mode-select" data-key="type">
                <option value="fixo" ${gasto.type === 'fixo' ? 'selected' : ''}>Fixo</option>
                <option value="variavel" ${gasto.type === 'variavel' ? 'selected' : ''}>Variável</option>
              </select>`
            : `<span class="data-field" data-key="type">${gasto.type === 'fixo' ? 'Fixo' : 'Variável'}</span>`;

        tds[4].innerHTML = enable
            ? `<input type="number" min="1" max="31" class="edit-mode" data-key="dueDay" value="${gasto.dueDay || ''}">`
            : `<span class="data-field" data-key="dueDay">${gasto.dueDay || '-'}</span>`;

        tds[5].querySelector('.status-check').disabled = enable;
        tds[6].style.display = enable ? 'none' : 'table-cell';
    });
    
    refs.selectAllSalario.disabled = enable;
    refs.markPaidAllSalario.disabled = enable;
    refs.selectAllVale.disabled = enable;
    refs.markPaidAllVale.disabled = enable;

    if (enable) {
        $$('.money-input').forEach(input => {
            input.addEventListener('input', formatCurrencyInput);
        });
    }
}

async function saveAllChanges() {
    const allGastosRows = $$('#salarioTable tbody tr, #valeTable tbody tr');
    const updatePromises = []; 

    allGastosRows.forEach((tr) => {
        const gastoId = tr.dataset.id;
        const gastoState = state.gastos.find(g => g.id == gastoId);
        if (!gastoState) return;

        const descInput = tr.querySelector('[data-key="desc"]');
        const valueInput = tr.querySelector('[data-key="value"]');
        const typeSelect = tr.querySelector('[data-key="type"]');
        const dueDayInput = tr.querySelector('[data-key="dueDay"]');

        const newDesc = descInput.value.trim();
        const newValue = unformatCurrency(valueInput.value);
        const newType = typeSelect.value;
        const newDueDay = dueDayInput.value.trim() ? parseInt(dueDayInput.value.trim(), 10) : null;

        if (newDesc !== gastoState.desc || newValue !== gastoState.value || newType !== gastoState.type || newDueDay !== gastoState.dueDay) {
             const updates = {
                desc: newDesc,
                value: newValue,
                type: newType,
                dueDay: newDueDay
            };
            updatePromises.push(updateGasto(gastoId, updates)); 
        }
    });
    
    await Promise.all(updatePromises);
    
    console.log("Todas as alterações foram salvas.");
    toggleEditMode(false);
    render(); 
}

function toggleAddFormCard() {
    const isHidden = refs.addFormCard.classList.contains('hidden');
    
    if (isHidden) {
        refs.addFormCard.classList.remove('hidden');
        refs.openAddFormBtn.classList.add('active');
    } else {
        refs.addFormCard.classList.add('hidden');
        refs.openAddFormBtn.classList.remove('active');
    }
}

/* --- Lógica de Eventos --- */
function setupEventListeners() {
    // --- Autenticação ---
    refs.authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = refs.authEmailInput.value;
        const password = refs.authPasswordInput.value;
        
        if (isLoginMode) {
            handleLogin(email, password);
        } else {
            handleSignUp(email, password);
        }
    });
    
    refs.authToggleLogin.addEventListener('click', () => toggleAuthMode(true));
    refs.authToggleRegister.addEventListener('click', () => toggleAuthMode(false));
    
    refs.logoutBtn.addEventListener('click', logout);
    
    // --- App (Restante) ---
    
    refs.openAddFormBtn.addEventListener('click', toggleAddFormCard);
    refs.closeAddFormBtn.addEventListener('click', toggleAddFormCard);

    refs.addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const novoGasto = {
            desc: $('#desc').value.trim(),
            value: unformatCurrency($('#value').value),
            type: $('#type').value,
            source: $('#source').value,
            dueDay: $('#due-day').value.trim() ? parseInt($('#due-day').value.trim(), 10) : null,
            paid: false
        };
        
        addGasto(novoGasto); 
        
        refs.addForm.reset();
        toggleAddFormCard(); 
    });

    refs.salarioInput.addEventListener('input', debouncedSaveProfile);
    refs.valeInput.addEventListener('input', debouncedSaveProfile);
    refs.salarioInput.addEventListener('blur', saveProfileData);
    refs.valeInput.addEventListener('blur', saveProfileData);
    
    const moneyInputs = document.querySelectorAll('.money-input, .balance-input');
    moneyInputs.forEach(input => {
        input.addEventListener('input', formatCurrencyInput);
        
        input.addEventListener('blur', (e) => {
            if (e.target.value.trim() === '' || unformatCurrency(e.target.value) === 0) {
                 if(e.target.id === 'salarioInput' || e.target.id === 'valeInput') {
                     e.target.value = ''; 
                     saveProfileData();
                 }
            }
        });
    });

    refs.btnClear.addEventListener('click', clearAllUserData);

    refs.themeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark-mode');
        const isDarkMode = document.documentElement.classList.contains('dark-mode');
        localStorage.setItem(STORAGE_THEME_KEY, isDarkMode ? 'dark' : 'light');
        refs.themeToggle.querySelector('#theme-icon').textContent = isDarkMode ? '☀️' : '🌙';
    });

    refs.editAllBtn.addEventListener('click', () => toggleEditMode(true));
    refs.saveAllBtn.addEventListener('click', saveAllChanges);
    refs.cancelEditBtn.addEventListener('click', () => {
        toggleEditMode(false);
        render(); 
    });
    
    refs.removeSelectedBtn.addEventListener('click', removeSelectedGastos);
    
    refs.selectAllSalario.addEventListener('change', handleSelectAllSalario);
    refs.markPaidAllSalario.addEventListener('change', handleMarkPaidAllSalario);
    refs.selectAllVale.addEventListener('change', handleSelectAllVale);
    refs.markPaidAllVale.addEventListener('change', handleMarkPaidAllVale);
}

/* --- Inicialização --- */
function init() {
    const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark-mode');
        refs.themeToggle.querySelector('#theme-icon').textContent = '☀️';
    } else {
        document.documentElement.classList.remove('dark-mode');
        refs.themeToggle.querySelector('#theme-icon').textContent = '🌙';
    }

    setupEventListeners();
    
    // A lógica de renderização e carregamento de dados
    // agora é disparada pelo 'onAuthStateChanged'
}

// Inicia a aplicação
init();