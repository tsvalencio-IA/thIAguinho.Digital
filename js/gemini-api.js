// NOME DO ARQUIVO: gemini-api.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { database, ref, push, set, get } from './firebase-config.js';

let chatHistoryCliente = [];
let chaveApiArmazenada = null; 

// =========================================================================
// CÉREBRO 1: A VENDEDORA E ARQUITETA
// =========================================================================
export let systemPrompt = `Você é o Arquiteto da 'thIAguinho Soluções'. Sua missão é entrevistar o cliente e descobrir suas dores corporativas.

REGRA ABSOLUTA DOS BOTÕES (NUNCA FALHE NESSA REGRA):
Você é OBRIGADO a finalizar TODAS as suas mensagens com opções clicáveis para facilitar a resposta do cliente no celular.
Formato exato: [OPCOES: Resposta completa 1 | Resposta completa 2]. NUNCA use "A" ou "B". NUNCA esqueça os botões.

FLUXO DA CONVERSA:
PASSO 1: Pergunte o nome e se quer sistema para Empresa ou Pessoal. (Use o botão [OPCOES: ...])
PASSO 2: Investigue a DOR principal. (Use o botão [OPCOES: ...])
PASSO 3: Diga: "Vou desenhar a arquitetura técnica. Por favor, digite seu WhatsApp com DDD."
PASSO 4: QUANDO RECEBER O WHATSAPP, agradeça e despeça-se. 

SEGREDO DA TAG (GERAR APENAS NO PASSO 4):
Na ÚLTIMA mensagem, cole exatamente esta tag no FINAL do seu texto. O sistema apagará antes do cliente ver.
[LEAD: NOME=nome do cliente | EMPRESA=tipo de negócio | DORES=resumo da dor | FACILITOIDE=arquitetura do sistema proposta | WHATSAPP=apenas numeros]`;

export function atualizarPromptMemoria(novoPrompt) {
    if (novoPrompt && novoPrompt.trim() !== '') {
        systemPrompt = novoPrompt;
    }
}

async function obterChaveDaApi() {
    if (chaveApiArmazenada) return chaveApiArmazenada;
    try {
        const snapshot = await get(ref(database, 'admin_config/gemini_api_key'));
        if (snapshot.exists()) {
            chaveApiArmazenada = snapshot.val();
            return chaveApiArmazenada;
        }
    } catch (e) { console.error("Erro Firebase:", e); }
    return null;
}

export async function askGemini(msgUsuario) {
    try {
        const apiKey = await obterChaveDaApi();
        if (!apiKey) return "Aviso: Chave da API não configurada no painel.";

        const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const contents = chatHistoryCliente.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
        contents.push({ role: 'user', parts: [{ text: msgUsuario }] });

        const res = await fetch(MODEL_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: contents, systemInstruction: { parts: [{ text: systemPrompt }] } })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        
        let botReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, ocorreu um erro de processamento.";
        
        const regexLead = /\[LEAD:\s*NOME=([\s\S]*?)\|\s*EMPRESA=([\s\S]*?)\|\s*DORES=([\s\S]*?)\|\s*FACILITOIDE=([\s\S]*?)\|\s*WHATSAPP=([\s\S]*?)\]/i;
        const match = botReply.match(regexLead);
        
        if (match) {
            const [, nome, empresa, dores, facilitoide, whatsapp] = match;
            let wppLimpo = whatsapp.replace(/\D/g, '');
            if (wppLimpo.startsWith('55') && wppLimpo.length > 11) wppLimpo = wppLimpo.substring(2); 

            const novoLeadRef = push(ref(database, 'projetos_capturados'));
            set(novoLeadRef, {
                nome: nome.trim() || "Cliente Indefinido", 
                empresa: empresa.trim() || "Não informada",
                dores: dores.trim() || "Sem dor detalhada", 
                facilitoide: facilitoide.trim() || "Arquitetura pendente.", 
                whatsapp: wppLimpo, 
                data: new Date().toISOString(), 
                devChat: [],
                status: 'novo'
            });
            
            botReply = botReply.replace(regexLead, '').trim();
        }
        return botReply;
    } catch(e) { return "Houve uma falha na conexão. Pode repetir a informação?"; }
}

export function adicionarAoHistorico(role, texto) {
    chatHistoryCliente.push({ role: role, text: texto });
}

// =========================================================================
// CÉREBRO 2: O DESENVOLVEDOR DA FÁBRICA (SaaS + TRIAL + CHAT REVERSO)
// =========================================================================
export async function conversarComDesenvolvedorIA(msgAdmin, contextoProjeto, historicoSalvo = [], idProjetoAtivo = "padrao") {
    try {
        const apiKey = await obterChaveDaApi();
        if (!apiKey) return "Configure a chave da API no Painel primeiro.";

        const promptDesenvolvedor = `Você é um Engenheiro de Software Sênior construindo sistemas SaaS para a thIAguinho Soluções.
        Projeto atual: ${contextoProjeto}
        ID do Banco de Dados do Cliente: ${idProjetoAtivo}
        
        Sempre coloque os códigos gerados em blocos Markdown (ex: \`\`\`html).

        DIRETRIZ MÁXIMA PARA DEMONSTRAÇÕES (TRIAL E CHAT REVERSO):
        Toda vez que você gerar um arquivo HTML completo para o cliente testar, você DEVE INCLUIR OBRIGATORIAMENTE 2 funções no código:
        
        1. SCRIPT DE BLOQUEIO DE 5 USOS (Trial Inteligente):
        - Crie uma lógica no JS gerado que conte "usos completos/ações reais" (ex: salvar um item de checklist, enviar um form de simulação) e salve no localStorage ('thIAguinho_trial_uses').
        - Não conte apenas cliques bobos na tela. Conte ações principais do sistema que você criar.
        - Quando a variável chegar a 5, congele o sistema injetando uma div preta fullscreen com z-index 9999 e o texto: "Atenção: A sua versão de demonstração expirou. Entre em contato com a thIAguinho Soluções para adquirir o sistema completo." Sem botão de fechar.
        
        2. CHAT DE FEEDBACK (CONEXÃO DIRETA COM O FIREBASE DO THIAGO):
        - Adicione um botão flutuante no HTML (ex: canto inferior direito) escrito: "Gostou? Fale com o Thiago".
        - Ao clicar, abre uma pequena interface de chat/input.
        - Quando o cliente digitar a mensagem e enviar, você DEVE fazer um POST usando a API REST do Firebase para salvar a mensagem diretamente no painel do Thiago.
        - URL EXATA PARA O FETCH DE ENVIO: https://thiaguinho-40a14-default-rtdb.firebaseio.com/projetos_capturados/${idProjetoAtivo}/feedbacks.json
        - PAYLOAD DO FETCH (method: 'POST'): JSON.stringify({ texto: mensagem_digitada, data: new Date().toISOString() })
        - Dê um alert amigável "Mensagem enviada!" ao cliente após o fetch e limpe o input.
        
        Comece sua resposta dizendo: "Thiago, o código está pronto. Ele já contém a blindagem de 5 usos reais e a conexão de feedback direto para o seu painel."`;

        const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const contents = historicoSalvo.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
        contents.push({ role: 'user', parts: [{ text: msgAdmin }] });

        const res = await fetch(MODEL_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: contents, systemInstruction: { parts: [{ text: promptDesenvolvedor }] } })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro de processamento.";

    } catch(e) {
        return "Erro de compilação na IA: " + e.message;
    }
}