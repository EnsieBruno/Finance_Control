/* --- Configuração do Supabase --- */
// Suas chaves já estão configuradas aqui
const SUPABASE_URL = 'https://edpwhxuefzhvrquvipqd.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcHdoeHVlZnpodnJxdXZpcHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNDkyOTgsImV4cCI6MjA3NjkyNTI5OH0.VYi3KLQVpXSJctdbIwkbAc3WqBgmYI3DQLLBPn0fnG8';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);


/* --- Configurações e Variáveis Globais --- */
const STORAGE_THEME_KEY = 'theme_mode';
let currentUser = null; 
let isLoginMode = true; 

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
let refs = {}; // Initialize empty, will be populated after DOM load

/* --- Funções Auxiliares --- */
const fmt = v => { if (isNaN(v)) v = 0; return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
const unformatCurrency = (value) => { const cleaned = String(value).replace(/[R$\s.]/g, '').replace(',', '.'); return parseFloat(cleaned) || 0; };
const formatCurrencyInput = (e) => { 
    let v = e.target.value.replace(/\D/g, ''); 
    if (v) { 
        v = (parseInt(v, 10) / 100).toFixed(2).replace('.', ','); 
        v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.'); 
        // Ensure leading zero for values < 1,00 but handle > 0,00
        if (v.length > 3 && v.indexOf('.') === v.length - 3 && v.startsWith(',')) {
            v = '0' + v; // Prepend 0 if it starts with comma like ",50"
        } else if (v.startsWith('.')) { 
            v = v.substring(1); // Remove leading dot if any leftover (less likely now)
        }
        e.target.value = `R$ ${v}`; 
    } else {
        e.target.value = ''; 
    }
};
let saveProfileTimeout; const debouncedSaveProfile = () => { clearTimeout(saveProfileTimeout); saveProfileTimeout = setTimeout(saveProfileData, 1000); };

// Função para alternar visibilidade da senha com SVGs
function togglePasswordVisibility(inputId, toggleId) {
    const input = $(`#${inputId}`);
    const toggleElement = $(`#${toggleId}`); // O span que contém os SVGs
    if (!input || !toggleElement) { console.error("Input or toggle element not found:", inputId, toggleId); return; }

    const eyeOn = toggleElement.querySelector('svg[id*="eye-on"]'); 
    const eyeOff = toggleElement.querySelector('svg[id*="eye-off"]');

    if (!eyeOn || !eyeOff) { console.error("Eye SVGs not found inside:", toggleId); return; }

    if (input.type === 'password') {
        input.type = 'text';
        eyeOn.style.display = 'none';   
        eyeOff.style.display = 'inline'; 
        input.classList.add('password-input-field'); 
    } else {
        input.type = 'password';
        eyeOn.style.display = 'inline'; 
        eyeOff.style.display = 'none';  
        input.classList.remove('password-input-field'); 
    }
}


/* --- Lógica de Banco de Dados (Supabase) --- */
async function loadInitialData() { 
    if (!currentUser) return;
    console.log("Carregando dados:", currentUser.id);
    try {
        const { data: profileData, error: profileError } = await supabaseClient.from('profiles').upsert({ id: currentUser.id, email: currentUser.email, updated_at: new Date().toISOString() }).select().single();
        if (profileError && profileError.code !== '23505') console.error('Erro perfil:', profileError);
        else if (profileData) { state.salarioInicial = profileData.salario || 0; state.valeInicial = profileData.vale || 0; state.profileLoaded = true; refs.salarioInput.value = state.salarioInicial > 0 ? fmt(state.salarioInicial) : ''; refs.valeInput.value = state.valeInicial > 0 ? fmt(state.valeInicial) : ''; }
        const { data: gastosData, error: gastosError } = await supabaseClient.from('gastos').select('*').eq('user_id', currentUser.id);
        if (gastosError) console.error('Erro gastos:', gastosError);
        else state.gastos = gastosData.map(g => ({ ...g, desc: g.description, paid: g.is_paid, dueDay: g.due_day ? parseInt(g.due_day, 10) : null })) || [];
    } catch (error) { console.error("Erro geral load:", error); } 
    finally { render(); }
}
async function saveProfileData() { 
    if (!currentUser || !state.profileLoaded) return; const newSalario = unformatCurrency(refs.salarioInput.value); const newVale = unformatCurrency(refs.valeInput.value); if (newSalario === state.salarioInicial && newVale === state.valeInicial) return; state.salarioInicial = newSalario; state.valeInicial = newVale; console.log("Salvando perfil...", { newSalario, newVale }); const { error } = await supabaseClient.from('profiles').update({ salario: state.salarioInicial, vale: state.valeInicial, updated_at: new Date().toISOString() }).eq('id', currentUser.id); if (error) console.error("Erro salvar perfil:", error); else console.log("Perfil salvo.");
}
async function addGasto(gasto) { 
    if (!currentUser) return; const gastoData = { user_id: currentUser.id, description: gasto.desc, value: gasto.value, type: gasto.type, source: gasto.source, due_day: gasto.dueDay || null, is_paid: gasto.paid }; const { data, error } = await supabaseClient.from('gastos').insert(gastoData).select().single(); if (error) console.error("Erro add gasto:", error); else { console.log("Gasto add:", data); state.gastos.push({ ...data, desc: data.description, paid: data.is_paid, dueDay: data.due_day ? parseInt(data.due_day, 10) : null }); render(); }
}
async function updateGasto(gastoId, updates) { 
    const dbUpdates = {}; if (updates.hasOwnProperty('desc')) dbUpdates.description = updates.desc; if (updates.hasOwnProperty('value')) dbUpdates.value = updates.value; if (updates.hasOwnProperty('type')) dbUpdates.type = updates.type; if (updates.hasOwnProperty('source')) dbUpdates.source = updates.source; if (updates.hasOwnProperty('dueDay')) dbUpdates.due_day = updates.dueDay || null; if (updates.hasOwnProperty('paid')) dbUpdates.is_paid = updates.paid; const { error } = await supabaseClient.from('gastos').update(dbUpdates).eq('id', gastoId); if (error) console.error("Erro update gasto:", error); else { const index = state.gastos.findIndex(g => g.id === gastoId); if (index > -1) { Object.assign(state.gastos[index], updates); render(); } }
}
async function deleteGasto(gastoId) { 
    const { error } = await supabaseClient.from('gastos').delete().eq('id', gastoId); if (error) console.error("Erro remover gasto:", error); else { console.log("Gasto removido:", gastoId); state.gastos = state.gastos.filter(x => x.id !== gastoId); selectedGastosIds = selectedGastosIds.filter(id => id !== gastoId); render(); }
}
async function deleteSelectedGastos() { 
    if (selectedGastosIds.length === 0) return; const { error } = await supabaseClient.from('gastos').delete().in('id', selectedGastosIds); if (error) console.error("Erro remover selecionados:", error); else { console.log("Selecionados removidos."); state.gastos = state.gastos.filter(g => !selectedGastosIds.includes(g.id)); selectedGastosIds = []; render(); }
}
async function clearAllUserData() { 
    if (!currentUser || !confirm('Atenção! Apagar TODOS os dados?')) return; try { const { error: gE } = await supabaseClient.from('gastos').delete().eq('user_id', currentUser.id); if (gE) throw gE; const { error: pE } = await supabaseClient.from('profiles').update({ salario: 0, vale: 0 }).eq('id', currentUser.id); if (pE) throw pE; console.log("Dados limpos."); state = { gastos: [], salarioInicial: 0, valeInicial: 0, profileLoaded: state.profileLoaded }; refs.salarioInput.value = ''; refs.valeInput.value = ''; render(); } catch (error) { console.error("Erro limpar dados:", error.message); }
}

/* --- Lógica de Autenticação --- */
function showAuthMessage(message, isError = false) { refs.authMessage.textContent = message; refs.authMessage.className = isError ? 'error' : 'success'; }
function showManageAccountMessage(message, isError = false, autoClear = true) { const el = refs.manageAccountMessage; el.textContent = message; el.className = isError ? 'auth-message error' : 'auth-message success'; if (autoClear) setTimeout(() => { el.textContent = ''; el.className = 'auth-message'; }, 3000); }
async function handleLogin(email, password) { showAuthMessage("Entrando...", false); const { error } = await supabaseClient.auth.signInWithPassword({ email, password }); if (error) { console.error('Erro login:', error.message); showAuthMessage(error.message, true); } else showAuthMessage("", false); }
async function handleSignUp(email, password) { showAuthMessage("Criando...", false); const { data, error } = await supabaseClient.auth.signUp({ email, password }); if (error) { console.error('Erro cadastro:', error.message); showAuthMessage(error.message, true); } else { console.log('Cadastrado:', data); showAuthMessage("Verifique seu e-mail.", false); } }
async function handleForgotPassword(e) { e.preventDefault(); const email = refs.authEmailInput.value; if (!email) { showAuthMessage("Digite e-mail.", true); return; } showAuthMessage("Enviando...", false); const redirectTo = window.location.origin + window.location.pathname; const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo }); if (error) { console.error('Erro reset:', error.message); showAuthMessage(error.message, true); } else { console.log('Link enviado'); showAuthMessage("E-mail enviado.", false); } }
async function logout() { const { error } = await supabaseClient.auth.signOut(); if (error) console.error('Erro sair:', error); else { currentUser = null; state = { gastos: [], salarioInicial: 0.00, valeInicial: 0.00, profileLoaded: false }; } }
function toggleAuthMode(toLogin) { isLoginMode = toLogin; showAuthMessage("", false); refs.authTitle.textContent = toLogin ? "Entrar" : "Cadastrar"; refs.authSubtitle.textContent = toLogin ? "Acesse sua conta." : "Crie uma nova conta."; refs.authSubmitBtn.textContent = toLogin ? "Entrar" : "Criar Conta"; refs.authToggleLogin.classList.toggle('active', toLogin); refs.authToggleRegister.classList.toggle('active', !toLogin); refs.forgotPasswordLink.style.display = toLogin ? 'block' : 'none'; }
supabaseClient.auth.onAuthStateChange((event, session) => { 
    if (!refs.authScreen) { setTimeout(() => supabaseClient.auth.onAuthStateChange(event, session), 50); return; }
    if (session && session.user) {
        currentUser = session.user; console.log('Logado:', currentUser.email);
        refs.authScreen.style.display = 'none'; refs.appContainer.style.display = 'flex';
        const firstLetter = currentUser.email ? currentUser.email[0].toUpperCase() : 'U'; refs.userAvatar.src = `https://placehold.co/40x40/11C76F/FFFFFF?text=${firstLetter}`; refs.userEmail.textContent = currentUser.email;
        loadInitialData();
    } else {
        currentUser = null; console.log('Deslogado.');
        refs.authScreen.style.display = 'flex'; refs.appContainer.style.display = 'none';
        refs.addFormCard.classList.add('hidden'); refs.manageAccountCard.classList.add('hidden'); refs.openAddFormBtn.classList.remove('active');
    }
});

/* --- Lógica de Gerenciamento de Conta --- */
async function handleManageAccountSubmit(e) { 
    e.preventDefault(); const newEmail = refs.updateEmailInput.value.trim(); const newPassword = refs.updatePasswordInput.value; const messageEl = refs.manageAccountMessage; const submitBtn = e.target.querySelector('button[type="submit"]'); const wantsEmailChange = newEmail && newEmail !== currentUser.email; const wantsPasswordChange = newPassword; if (!wantsEmailChange && !wantsPasswordChange) { showManageAccountMessage("Preencha e-mail ou senha.", true); return; } if (wantsPasswordChange && newPassword.length < 6) { showManageAccountMessage("Nova senha: min. 6 caracteres.", true); return; } const currentPassword = prompt("Senha atual para confirmar:"); if (currentPassword === null) return; if (!currentPassword) { showManageAccountMessage("Senha atual obrigatória.", true); return; } submitBtn.disabled = true; showManageAccountMessage("Verificando...", false, false); const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email: currentUser.email, password: currentPassword }); if (signInError) { console.error('Erro senha:', signInError.message); showManageAccountMessage("Senha atual incorreta.", true); submitBtn.disabled = false; return; } const updates = {}; if (wantsEmailChange) updates.email = newEmail; if (wantsPasswordChange) { if (newPassword === currentPassword) { showManageAccountMessage("Nova senha igual à atual.", true); submitBtn.disabled = false; return; } updates.password = newPassword; } if (Object.keys(updates).length > 0) { const { error: updateError } = await supabaseClient.auth.updateUser(updates); if (updateError) { console.error('Erro update:', updateError.message); showManageAccountMessage(`Erro: ${updateError.message}`, true); } else { let msg = "Salvo!"; if (wantsEmailChange) msg += " Verifique e-mails."; console.log('Atualizado:', updates); showManageAccountMessage(msg, false); refs.updateEmailInput.value = ''; refs.updatePasswordInput.value = ''; } } else showManageAccountMessage("Nada a alterar.", false); submitBtn.disabled = false;
}

/* --- Renderização da Interface --- */
function handleSelectAll(source, isChecked) { 
    const sourceGastos = state.gastos.filter(g => g.source === source); sourceGastos.forEach(g => { const isSel = selectedGastosIds.includes(g.id); if (isChecked && !isSel) selectedGastosIds.push(g.id); else if (!isChecked && isSel) selectedGastosIds = selectedGastosIds.filter(id => id !== g.id); }); render(); 
}
async function handleMarkPaidAll(source, isChecked) { 
    const sourceGastos = state.gastos.filter(g => g.source === source); const idsToUpdate = sourceGastos.map(g => g.id); sourceGastos.forEach(g => { g.paid = isChecked; }); render(); if (idsToUpdate.length > 0) { const { error } = await supabaseClient.from('gastos').update({ is_paid: isChecked }).in('id', idsToUpdate); if (error) console.error("Erro marcar pagos:", error); }
}
const handleSelectAllSalario = (e) => handleSelectAll('salario', e.target.checked); const handleMarkPaidAllSalario = (e) => handleMarkPaidAll('salario', e.target.checked); const handleSelectAllVale = (e) => handleSelectAll('vale', e.target.checked); const handleMarkPaidAllVale = (e) => handleMarkPaidAll('vale', e.target.checked);
function updateBulkActionButtons(source) { 
    const isSalario = source === 'salario'; const sourceGastos = state.gastos.filter(g => g.source === source); const allSelected = sourceGastos.length > 0 && sourceGastos.every(g => selectedGastosIds.includes(g.id)); const allPaid = sourceGastos.length > 0 && sourceGastos.every(g => g.paid); const selectBtn = isSalario ? refs.mobileSelectAllSalarioBtn : refs.mobileSelectAllValeBtn; const paidBtn = isSalario ? refs.mobileMarkPaidAllSalarioBtn : refs.mobileMarkPaidAllValeBtn; if (selectBtn) { selectBtn.textContent = allSelected ? "Desselecionar" : "Selecionar Todos"; selectBtn.disabled = sourceGastos.length === 0 || isEditing; } if (paidBtn) { paidBtn.textContent = allPaid ? "Marcar Não Pagos" : "Marcar Pagos"; paidBtn.disabled = sourceGastos.length === 0 || isEditing; }
}
function handleMobileSelectAll(source) { const sourceGastos = state.gastos.filter(g => g.source === source); const allSelected = sourceGastos.length > 0 && sourceGastos.every(g => selectedGastosIds.includes(g.id)); handleSelectAll(source, !allSelected); }
function handleMobileMarkPaidAll(source) { const sourceGastos = state.gastos.filter(g => g.source === source); const allPaid = sourceGastos.length > 0 && sourceGastos.every(g => g.paid); handleMarkPaidAll(source, !allPaid); }
function updateHeaderCheckboxes(source, type) { 
    const isSalario = source === 'salario'; const allChecks = $$(`#${source}Table tbody .${type === 'select' ? 'select-check' : 'status-check'}`); const allChecked = Array.from(allChecks).every(chk => chk.checked); let headerChk, listener; if (type === 'select') { headerChk = isSalario ? refs.selectAllSalario : refs.selectAllVale; listener = isSalario ? handleSelectAllSalario : handleSelectAllVale; } else { headerChk = isSalario ? refs.markPaidAllSalario : refs.markPaidAllVale; listener = isSalario ? handleMarkPaidAllSalario : handleMarkPaidAllVale; } if (headerChk) { headerChk.removeEventListener('change', listener); headerChk.checked = allChecks.length > 0 && allChecked; headerChk.addEventListener('change', listener); headerChk.disabled = allChecks.length === 0 || isEditing; } updateBulkActionButtons(source); 
}
function handleRowClick(event) { 
    const interactive = ['INPUT', 'BUTTON', 'SELECT', 'A']; if (interactive.includes(event.target.tagName) || event.target.closest('.actions-cell') || event.target.closest('.edit-mode')) return; const tr = event.currentTarget; const isMobile = window.innerWidth <= 550; if (isMobile && !isEditing) tr.classList.toggle('expanded');
}
function createTableRow(gasto) { 
    const tr = document.createElement('tr'); tr.dataset.id = gasto.id; tr.addEventListener('click', handleRowClick);
    const tdSelect = document.createElement('td'); tdSelect.dataset.label = 'Sel.'; const chkSelect = document.createElement('input'); chkSelect.type = 'checkbox'; chkSelect.className = 'select-check'; chkSelect.checked = selectedGastosIds.includes(gasto.id); chkSelect.disabled = isEditing; chkSelect.addEventListener('change', () => { if (chkSelect.checked) { if (!selectedGastosIds.includes(gasto.id)) selectedGastosIds.push(gasto.id); } else selectedGastosIds = selectedGastosIds.filter(id => id !== gasto.id); updateSelectionTotal(); updateHeaderCheckboxes(gasto.source, 'select'); }); tdSelect.appendChild(chkSelect); tr.appendChild(tdSelect); 
    const tdDesc = document.createElement('td'); tdDesc.dataset.label = 'Descrição'; tdDesc.innerHTML = `<span class="data-field" data-key="desc">${gasto.desc}</span>`; tr.appendChild(tdDesc);
    const tdVal = document.createElement('td'); tdVal.dataset.label = 'Valor'; tdVal.innerHTML = `<span class="data-field" data-key="value">${fmt(gasto.value)}</span>`; tr.appendChild(tdVal);
    const tdType = document.createElement('td'); tdType.dataset.label = 'Tipo'; tdType.innerHTML = `<span class="data-field" data-key="type">${gasto.type === 'fixo' ? 'Fixo' : 'Variável'}</span>`; tr.appendChild(tdType);
    const tdDueDay = document.createElement('td'); tdDueDay.dataset.label = 'Vencimento'; tdDueDay.innerHTML = `<span class="data-field" data-key="dueDay">${gasto.dueDay || '-'}</span>`; tr.appendChild(tdDueDay);
    const tdPaid = document.createElement('td'); tdPaid.dataset.label = 'Pago'; const chk = document.createElement('input'); chk.type = 'checkbox'; chk.className = 'status-check'; chk.checked = gasto.paid; chk.disabled = isEditing; chk.addEventListener('change', () => { updateGasto(gasto.id, { paid: chk.checked }); }); tdPaid.appendChild(chk); tr.appendChild(tdPaid);
    const tdActions = document.createElement('td'); tdActions.dataset.label = 'Ação'; tdActions.className = 'actions-cell'; const btnDelete = document.createElement('button'); btnDelete.className = 'btn delete-item-btn'; btnDelete.innerHTML = '&#x2715;'; /* Usando HTML entity para X */ btnDelete.style.display = isEditing ? 'none' : 'inline-flex'; btnDelete.addEventListener('click', (e) => { e.stopPropagation(); if (confirm(`Remover "${gasto.desc}"?`)) deleteGasto(gasto.id); }); tdActions.appendChild(btnDelete); tr.appendChild(tdActions);
    return tr;
}
function render() { 
    if (!currentUser) return; const entradas = state.salarioInicial + state.valeInicial; const pagos = state.gastos.filter(g => g.paid).reduce((s, g) => s + g.value, 0); const saldo = entradas - pagos; refs.saldoFinalEl.textContent = fmt(saldo); refs.saldoFinalEl.style.color = saldo >= 0 ? 'var(--purple-main)' : 'var(--red-alert)'; const gSalario = state.gastos.filter(g => g.source === 'salario').sort((a,b)=>(a.type==='fixo'?-1:1)); const gVale = state.gastos.filter(g => g.source === 'vale').sort((a,b)=>(a.type==='fixo'?-1:1)); refs.salarioTableBody.innerHTML = ''; gSalario.forEach(g => refs.salarioTableBody.appendChild(createTableRow(g))); refs.valeTableBody.innerHTML = ''; gVale.forEach(g => refs.valeTableBody.appendChild(createTableRow(g))); updateHeaderCheckboxes('salario', 'select'); updateHeaderCheckboxes('salario', 'paid'); updateHeaderCheckboxes('vale', 'select'); updateHeaderCheckboxes('vale', 'paid'); updateSelectionTotal(); 
}
function updateSelectionTotal() { 
    const sel = state.gastos.filter(g => selectedGastosIds.includes(g.id)); const total = sel.reduce((s, g) => s + g.value, 0); const count = sel.length; refs.selectedTotalEl.textContent = fmt(total); refs.selectedCountEl.textContent = `${count} selecionada${count !== 1 ? 's' : ''}`; refs.removeSelectedBtn.textContent = `Remover (${count})`; refs.selectionActions.classList.toggle('hidden', count === 0 || isEditing);
}
function removeSelectedGastos() { if (selectedGastosIds.length === 0 || !confirm(`Remover ${selectedGastosIds.length}?`)) return; deleteSelectedGastos(); }
function toggleEditMode(enable) { 
    isEditing = enable; refs.editAllBtn.style.display = enable ? 'none' : 'inline-block'; refs.saveAllBtn.style.display = enable ? 'inline-block' : 'none'; refs.cancelEditBtn.style.display = enable ? 'inline-block' : 'none'; refs.btnClear.style.display = enable ? 'none' : 'inline-block'; refs.openAddFormBtn.style.display = enable ? 'none' : 'block'; refs.selectionActions.classList.add('hidden'); refs.addFormCard.classList.add('hidden'); refs.manageAccountCard.classList.add('hidden'); refs.openAddFormBtn.classList.remove('active'); refs.exportCsvBtn.disabled = enable; refs.importCsvBtn.disabled = enable; refs.manageAccountBtn.disabled = enable; if(refs.mobileSelectAllSalarioBtn) refs.mobileSelectAllSalarioBtn.disabled = enable; if(refs.mobileMarkPaidAllSalarioBtn) refs.mobileMarkPaidAllSalarioBtn.disabled = enable; if(refs.mobileSelectAllValeBtn) refs.mobileSelectAllValeBtn.disabled = enable; if(refs.mobileMarkPaidAllValeBtn) refs.mobileMarkPaidAllValeBtn.disabled = enable; $$('#salarioTable tbody tr, #valeTable tbody tr').forEach((tr) => { const g = state.gastos.find(g => g.id == tr.dataset.id); if (!g) return; const tds = tr.querySelectorAll('td'); tds[0].querySelector('.select-check').disabled = enable; tds[1].innerHTML = enable ? `<input type="text" class="edit-mode" data-key="desc" value="${g.desc}">` : `<span class="data-field" data-key="desc">${g.desc}</span>`; tds[2].innerHTML = enable ? `<input type="text" class="edit-mode money-input" data-key="value" value="${fmt(g.value)}">` : `<span class="data-field" data-key="value">${fmt(g.value)}</span>`; tds[3].innerHTML = enable ? `<select class="edit-mode edit-mode-select" data-key="type"><option value="fixo" ${g.type==='fixo'?'selected':''}>Fixo</option><option value="variavel" ${g.type==='variavel'?'selected':''}>Variável</option></select>` : `<span class="data-field" data-key="type">${g.type==='fixo'?'Fixo':'Variável'}</span>`; tds[4].innerHTML = enable ? `<input type="number" min="1" max="31" class="edit-mode" data-key="dueDay" value="${g.dueDay||''}">` : `<span class="data-field" data-key="dueDay">${g.dueDay||'-'}</span>`; tds[5].querySelector('.status-check').disabled = enable; tds[6].style.display = enable ? 'none' : 'table-cell'; }); if (refs.selectAllSalario) refs.selectAllSalario.disabled = enable; if (refs.markPaidAllSalario) refs.markPaidAllSalario.disabled = enable; if (refs.selectAllVale) refs.selectAllVale.disabled = enable; if (refs.markPaidAllVale) refs.markPaidAllVale.disabled = enable; if (enable) $$('.money-input').forEach(input => input.addEventListener('input', formatCurrencyInput)); else { refs.exportCsvBtn.disabled = false; refs.importCsvBtn.disabled = false; refs.manageAccountBtn.disabled = false; if(refs.mobileSelectAllSalarioBtn) refs.mobileSelectAllSalarioBtn.disabled = false; if(refs.mobileMarkPaidAllSalarioBtn) refs.mobileMarkPaidAllSalarioBtn.disabled = false; if(refs.mobileSelectAllValeBtn) refs.mobileSelectAllValeBtn.disabled = false; if(refs.mobileMarkPaidAllValeBtn) refs.mobileMarkPaidAllValeBtn.disabled = false; }
}
async function saveAllChanges() { 
    const updates = []; $$('#salarioTable tbody tr, #valeTable tbody tr').forEach((tr) => { const gId = tr.dataset.id; const gState = state.gastos.find(g => g.id == gId); if (!gState) return; const dIn = tr.querySelector('[data-key="desc"]'); const vIn = tr.querySelector('[data-key="value"]'); const tSel = tr.querySelector('[data-key="type"]'); const ddIn = tr.querySelector('[data-key="dueDay"]'); const nD = dIn.value.trim(); const nV = unformatCurrency(vIn.value); const nT = tSel.value; const nDD = ddIn.value.trim() ? parseInt(ddIn.value.trim(), 10) : null; if (nD !== gState.desc || nV !== gState.value || nT !== gState.type || nDD !== gState.dueDay) updates.push(updateGasto(gId, { desc: nD, value: nV, type: nT, dueDay: nDD })); }); await Promise.all(updates); console.log("Salvo."); toggleEditMode(false); 
}
function toggleAddFormCard() { const hide = refs.addFormCard.classList.contains('hidden'); refs.addFormCard.classList.toggle('hidden', !hide); refs.openAddFormBtn.classList.toggle('active', hide); if (hide) refs.manageAccountCard.classList.add('hidden'); }
function toggleManageAccountCard() { const hide = refs.manageAccountCard.classList.contains('hidden'); refs.manageAccountCard.classList.toggle('hidden', !hide); if (hide) { refs.addFormCard.classList.add('hidden'); refs.openAddFormBtn.classList.remove('active'); refs.updateEmailInput.value = ''; refs.updatePasswordInput.value = ''; showManageAccountMessage("", false); } }

/* --- Funções de Import/Export CSV --- */
function downloadCSV(csv) { const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); const url = URL.createObjectURL(blob); link.href = url; link.download = 'gastos.csv'; link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); }
function exportToCSV() { if (state.gastos.length === 0) { alert("Nada a exportar."); return; } const data = state.gastos.map(g => ({ description: g.desc, value: g.value, type: g.type, source: g.source, due_day: g.dueDay, is_paid: g.paid })); const csv = Papa.unparse(data, { header: true }); downloadCSV(csv); }
function handleImportCSV() { refs.csvFileInput.click(); }
function handleFileSelect(event) { const file = event.target.files[0]; if (!file) return; Papa.parse(file, { header: true, skipEmptyLines: true, complete: async (res) => { if (!res.data || res.data.length === 0) { alert("CSV inválido."); return; } const inserts = res.data.map(r => ({ user_id: currentUser.id, description: r.description || r.Descrição, value: parseFloat(String(r.value).replace(',', '.')) || 0, type: r.type || r.Tipo, source: r.source || r.Fonte, due_day: parseInt(r.due_day || r['Vencimento (Dia)']) || null, is_paid: (r.is_paid || r.Pago || 'false').toLowerCase() === 'true' })).filter(g => g.description && g.value > 0); if (inserts.length === 0) { alert("Dados inválidos."); return; } if (confirm(`Importar ${inserts.length}?`)) { const { error } = await supabaseClient.from('gastos').insert(inserts); if (error) { console.error("Erro import:", error); alert(`Erro: ${error.message}`); } else { alert(`${inserts.length} importados!`); await loadInitialData(); } } refs.csvFileInput.value = null; }, error: (err) => { alert(`Erro CSV: ${err.message}`); refs.csvFileInput.value = null; } }); }

/* --- Lógica de Eventos --- */
function setupEventListeners() {
    // Verifica se refs.authForm existe antes de adicionar listener
    if (refs.authForm) {
        refs.authForm.addEventListener('submit', (e) => { 
            e.preventDefault(); 
            if (isLoginMode) handleLogin(refs.authEmailInput.value, refs.authPasswordInput.value); 
            else handleSignUp(refs.authEmailInput.value, refs.authPasswordInput.value); 
        });
    } else {
        console.error("Elemento #auth-form não encontrado!");
    }

    if (refs.authToggleLogin) refs.authToggleLogin.addEventListener('click', () => toggleAuthMode(true)); 
    if (refs.authToggleRegister) refs.authToggleRegister.addEventListener('click', () => toggleAuthMode(false)); 
    if (refs.forgotPasswordLink) refs.forgotPasswordLink.addEventListener('click', handleForgotPassword); 
    if (refs.logoutBtn) refs.logoutBtn.addEventListener('click', logout); 
    if (refs.toggleAuthPassword) refs.toggleAuthPassword.addEventListener('click', () => togglePasswordVisibility('auth-password', 'toggle-auth-password')); 
    
    if (refs.openAddFormBtn) refs.openAddFormBtn.addEventListener('click', toggleAddFormCard); 
    if (refs.closeAddFormBtn) refs.closeAddFormBtn.addEventListener('click', toggleAddFormCard); 
    if (refs.manageAccountBtn) refs.manageAccountBtn.addEventListener('click', toggleManageAccountCard); 
    if (refs.closeManageAccountBtn) refs.closeManageAccountBtn.addEventListener('click', toggleManageAccountCard); 
    if (refs.manageAccountForm) refs.manageAccountForm.addEventListener('submit', handleManageAccountSubmit); 
    if (refs.toggleUpdatePassword) refs.toggleUpdatePassword.addEventListener('click', () => togglePasswordVisibility('update-password', 'toggle-update-password')); 
    
    if (refs.addForm) refs.addForm.addEventListener('submit', (e) => { e.preventDefault(); addGasto({ desc: $('#desc').value.trim(), value: unformatCurrency($('#value').value), type: $('#type').value, source: $('#source').value, dueDay: $('#due-day').value.trim() ? parseInt($('#due-day').value.trim(), 10) : null, paid: false }); refs.addForm.reset(); toggleAddFormCard(); });
    
    if (refs.salarioInput) { refs.salarioInput.addEventListener('input', debouncedSaveProfile); refs.salarioInput.addEventListener('blur', saveProfileData); }
    if (refs.valeInput) { refs.valeInput.addEventListener('input', debouncedSaveProfile); refs.valeInput.addEventListener('blur', saveProfileData); }
    
    $$('.money-input, .balance-input').forEach(i => { i.addEventListener('input', formatCurrencyInput); i.addEventListener('blur', (e) => { if (e.target.value.trim() === '' || unformatCurrency(e.target.value) === 0) if(e.target.id === 'salarioInput' || e.target.id === 'valeInput') { e.target.value = ''; saveProfileData(); } }); });
    
    if (refs.btnClear) refs.btnClear.addEventListener('click', clearAllUserData); 
    if (refs.themeToggle) refs.themeToggle.addEventListener('click', () => { document.documentElement.classList.toggle('dark-mode'); const iD = document.documentElement.classList.contains('dark-mode'); localStorage.setItem(STORAGE_THEME_KEY, iD ? 'dark' : 'light'); if (refs.themeToggle && refs.themeToggle.querySelector('#theme-icon')) { refs.themeToggle.querySelector('#theme-icon').textContent = iD ? '☀️' : '🌙'; } });
    
    if (refs.editAllBtn) refs.editAllBtn.addEventListener('click', () => toggleEditMode(true)); 
    if (refs.saveAllBtn) refs.saveAllBtn.addEventListener('click', saveAllChanges); 
    if (refs.cancelEditBtn) refs.cancelEditBtn.addEventListener('click', () => { toggleEditMode(false); render(); });
    if (refs.removeSelectedBtn) refs.removeSelectedBtn.addEventListener('click', removeSelectedGastos);
    
    if(refs.selectAllSalario) refs.selectAllSalario.addEventListener('change', handleSelectAllSalario); if(refs.markPaidAllSalario) refs.markPaidAllSalario.addEventListener('change', handleMarkPaidAllSalario); if(refs.selectAllVale) refs.selectAllVale.addEventListener('change', handleSelectAllVale); if(refs.markPaidAllVale) refs.markPaidAllVale.addEventListener('change', handleMarkPaidAllVale);
    
    if (refs.exportCsvBtn) refs.exportCsvBtn.addEventListener('click', exportToCSV); 
    if (refs.importCsvBtn) refs.importCsvBtn.addEventListener('click', handleImportCSV); 
    if (refs.csvFileInput) refs.csvFileInput.addEventListener('change', handleFileSelect);
    
    if(refs.mobileSelectAllSalarioBtn) refs.mobileSelectAllSalarioBtn.addEventListener('click', () => handleMobileSelectAll('salario')); if(refs.mobileMarkPaidAllSalarioBtn) refs.mobileMarkPaidAllSalarioBtn.addEventListener('click', () => handleMobileMarkPaidAll('salario')); if(refs.mobileSelectAllValeBtn) refs.mobileSelectAllValeBtn.addEventListener('click', () => handleMobileSelectAll('vale')); if(refs.mobileMarkPaidAllValeBtn) refs.mobileMarkPaidAllValeBtn.addEventListener('click', () => handleMobileMarkPaidAll('vale'));
}

/* --- Inicialização --- */
function initializeRefs() {
     refs = {
        authScreen: $('#auth-screen'), appContainer: $('#app-container'), authForm: $('#auth-form'), authEmailInput: $('#auth-email'), authPasswordInput: $('#auth-password'), authSubmitBtn: $('#auth-submit-btn'), authToggleLogin: $('#auth-toggle-login'), authToggleRegister: $('#auth-toggle-register'), authTitle: $('#auth-title'), authSubtitle: $('#auth-subtitle'), authMessage: $('#auth-message'), forgotPasswordLink: $('#forgot-password-link'), toggleAuthPassword: $('#toggle-auth-password'), logoutBtn: $('#logout-btn'), userInfo: $('#user-info'), userAvatar: $('#user-avatar'), userEmail: $('#user-email'), salarioInput: $('#salarioInput'), valeInput: $('#valeInput'), saldoFinalEl: $('#saldoFinal'), addForm: $('#addForm'), salarioTableBody: $('#salarioTable tbody'), valeTableBody: $('#valeTable tbody'), btnClear: $('#btnClear'), themeToggle: $('#themeToggle'), editAllBtn: $('#editAllBtn'), saveAllBtn: $('#saveAllBtn'), cancelEditBtn: $('#cancelEditBtn'), openAddFormBtn: $('#openAddFormBtn'), closeAddFormBtn: $('#closeAddFormBtn'), addFormCard: $('#addFormCard'), manageAccountBtn: $('#manage-account-btn'), manageAccountCard: $('#manageAccountCard'), closeManageAccountBtn: $('#closeManageAccountBtn'), manageAccountForm: $('#manage-account-form'), updateEmailInput: $('#update-email'), updatePasswordInput: $('#update-password'), manageAccountMessage: $('#manage-account-message'), toggleUpdatePassword: $('#toggle-update-password'), selectionActions: $('#selectionActions'), selectedTotalEl: $('#selectedTotal'), selectedCountEl: $('#selectedCount'), removeSelectedBtn: $('#removeSelectedBtn'), selectAllSalario: $('#selectAllSalario'), markPaidAllSalario: $('#markPaidAllSalario'), selectAllVale: $('#selectAllVale'), markPaidAllVale: $('#markPaidAllVale'), exportCsvBtn: $('#export-csv-btn'), importCsvBtn: $('#import-csv-btn'), csvFileInput: $('#csv-file-input'), mobileSelectAllSalarioBtn: $('#mobileSelectAllSalario'), mobileMarkPaidAllSalarioBtn: $('#mobileMarkPaidAllSalario'), mobileSelectAllValeBtn: $('#mobileSelectAllVale'), mobileMarkPaidAllValeBtn: $('#mobileMarkPaidAllVale'),
    };
}
function init() {
    initializeRefs(); 
    const theme = localStorage.getItem(STORAGE_THEME_KEY);
    if (theme === 'dark') { 
        document.documentElement.classList.add('dark-mode'); 
        if (refs.themeToggle && refs.themeToggle.querySelector('#theme-icon')) { refs.themeToggle.querySelector('#theme-icon').textContent = '☀️'; }
    } else { 
        document.documentElement.classList.remove('dark-mode'); 
        if (refs.themeToggle && refs.themeToggle.querySelector('#theme-icon')) { refs.themeToggle.querySelector('#theme-icon').textContent = '🌙'; }
    }
    setupEventListeners();
}

document.addEventListener('DOMContentLoaded', init);