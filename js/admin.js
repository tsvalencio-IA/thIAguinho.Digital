import { auth, db, appId, collection, doc, setDoc, onSnapshot, addDoc, getDoc } from './firebase-config.js';
import { systemInstruction, setSystemInstruction } from './gemini-api.js';

let currentUser = null;
export let unsubLeads = null;

const leadsCollectionPath = `agencia/${appId}/leads`;
const settingsDocPath = `agencia/${appId}/settings/prompt`;

export function setCurrentUser(user) {
    currentUser = user;
}

export async function salvarLeadFirestore(leadData) {
    if (!currentUser) return;
    try {
        leadData.dataRegistro = new Date().toISOString();
        await addDoc(collection(db, ...leadsCollectionPath.split('/')), leadData);
    } catch (error) {
        console.error("Erro ao salvar lead:", error);
    }
}

export function iniciarEscutaCRM() {
    if (!currentUser) return;
    const ref = collection(db, ...leadsCollectionPath.split('/'));
    
    unsubLeads = onSnapshot(ref, (snapshot) => {
        const tableBody = document.getElementById('leads-table-body');
        tableBody.innerHTML = '';
        
        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-500">Nenhum lead capturado ainda.</td></tr>';
            return;
        }

        const leads = [];
        snapshot.forEach(doc => leads.push({ id: doc.id, ...doc.data() }));
        leads.sort((a, b) => new Date(b.dataRegistro) - new Date(a.dataRegistro));

        leads.forEach(lead => {
            const dataFormatada = new Date(lead.dataRegistro).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' });
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-800 transition';
            tr.innerHTML = `
                <td class="p-4 text-slate-400 text-xs">${dataFormatada}</td>
                <td class="p-4"><p class="font-bold text-white">${lead.nome}</p><p class="text-xs text-slate-400">${lead.empresa}</p></td>
                <td class="p-4 text-red-300 font-medium">${lead.dor}</td>
                <td class="p-4 font-mono text-emerald-400">${lead.whatsapp}</td>
            `;
            tableBody.appendChild(tr);
        });
    }, (error) => console.error(error));
}

export async function carregarCerebroIA() {
    if (!currentUser) return;
    try {
        const docRef = doc(db, ...settingsDocPath.split('/'));
        const docSnap = await getDoc(docRef);
        const txtArea = document.getElementById('system-prompt');
        
        if (docSnap.exists() && docSnap.data().prompt) {
            setSystemInstruction(docSnap.data().prompt);
        }
        txtArea.value = systemInstruction;
    } catch (error) {
        console.error("Erro ao ler o cérebro:", error);
    }
}

export function initAdminControls() {
    document.getElementById('btn-save-prompt').addEventListener('click', async () => {
        if (!currentUser) return;
        const newPrompt = document.getElementById('system-prompt').value;
        try {
            const docRef = doc(db, ...settingsDocPath.split('/'));
            await setDoc(docRef, { prompt: newPrompt });
            setSystemInstruction(newPrompt);
            
            const status = document.getElementById('prompt-status');
            status.classList.remove('opacity-0');
            setTimeout(() => status.classList.add('opacity-0'), 3000);
        } catch (error) {
            console.error("Erro ao gravar:", error);
            alert("Falha ao gravar no Firebase.");
        }
    });
}
