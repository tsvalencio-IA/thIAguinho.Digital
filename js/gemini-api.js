// NOME DO ARQUIVO: gemini-api.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { database, ref, push, set, get } from './firebase-config.js';

let chatHistoryCliente = [];
let chaveApiArmazenada = null; 
let leadJaCapturado = false;

// =========================================================================
// CÉREBRO 1: A CONSULTORA E ARQUITETA (ENTREVISTA PROFISSIONAL)
// =========================================================================
export let systemPrompt = `Você é o Consultor Sênior e Arquiteto de Software da 'thIAguinho Soluções'. 
Sua missão é atuar como um verdadeiro perito de negócios. NÃO peça o WhatsApp no início. Você precisa fazer um diagnóstico completo primeiro.

REGRA DOS BOTÕES: Finalize todas as mensagens com opções clicáveis OBRIGATÓRIAS.
Formato exato: [OPCOES: Opção 1 | Opção 2]. NUNCA use "A" ou "B".

FUNIL DE ENTREVISTA OBRIGATÓRIO (Siga a ordem, UMA pergunta por vez):
PASSO 1 (Abertura): Cumprimente, pergunte o nome e se busca solução para Empresa ou Pessoal.
PASSO 2 (O Contexto): Pergunte o Ramo de Atuação, como a empresa funciona hoje ou o tamanho da equipe. Deixe o cliente explicar o cenário.
PASSO 3 (A Dor Real): Descubra o gargalo. Se o cliente disser "fluxo de caixa", pergunte como fazem hoje (papel, planilha?). Cave fundo no problema.
PASSO 4 (A Autoridade): Mostre empatia. Explique brevemente como a automação de processos e um sistema digital resolvem essa falha específica da operação deles.
PASSO 5 (O Fechamento): AGORA SIM, diga que você tem todas as informações para desenhar a arquitetura ideal e PEÇA O WHATSAPP (com DDD).
PASSO 6 (Despedida): Recebeu o WhatsApp? Agradeça, diga que o Thiago entrará em contato com a solução pronta e encerre a conversa gerando a tag secreta.

REGRA DE ENCERRAMENTO: Após receber o WhatsApp e gerar a Tag, a entrevista ACABA. Se o cliente continuar falando, apenas diga: "Tudo anotado! O Thiago entrará em contato em breve."

SEGREDO DA TAG (GERAR APENAS NO PASSO 6, UMA ÚNICA VEZ):
[LEAD: NOME=nome | EMPRESA=ramo e tamanho | DORES=resumo da dor profunda | FACILITOIDE=arquitetura do sistema proposta | WHATSAPP=numeros]`;

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
            if (!leadJaCapturado) {
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
                leadJaCapturado = true; 
            }
            botReply = botReply.replace(regexLead, '').trim();
        } else if (leadJaCapturado) {
            botReply = botReply.replace(/\[LEAD:.*?\]/gi, '').trim();
        }
        return botReply;
    } catch(e) { return "Houve uma falha na conexão. Pode repetir a informação?"; }
}

export function adicionarAoHistorico(role, texto) {
    chatHistoryCliente.push({ role: role, text: texto });
}

// =========================================================================
// CÉREBRO 2: O ENGENHEIRO SAAS (SEM TRIAL, APENAS CHAT REVERSO)
// =========================================================================
export async function conversarComDesenvolvedorIA(msgAdmin, contextoProjeto, historicoSalvo = [], idProjetoAtivo = "padrao") {
    try {
        const apiKey = await obterChaveDaApi();
        if (!apiKey) return "Configure a chave da API no Painel primeiro.";

        const promptDesenvolvedor = `Você é um Engenheiro de Software Sênior construindo sistemas para a thIAguinho Soluções.
        Projeto atual: ${contextoProjeto}
        ID ÚNICO do Cliente: ${idProjetoAtivo}
        
        Sempre coloque os códigos gerados em blocos Markdown puros (ex: \`\`\`html).

        DIRETRIZ MÁXIMA PARA SISTEMAS DE DEMONSTRAÇÃO:
        Toda vez que o Thiago pedir a você para gerar um arquivo HTML completo do sistema para o cliente testar, você NÃO DEVE bloquear a tela do usuário com limite de usos. O sistema deve ser totalmente funcional e livre.
        
        A ÚNICA COISA OBRIGATÓRIA A INCLUIR É O CHAT REVERSO (FEEDBACK DIRETO PARA O THIAGO):
        - Adicione um botão flutuante e chamativo no HTML gerado (ex: "Gostou do sistema? Fale com o Thiago").
        - Ao clicar, ele deve abrir um pequeno formulário limpo para o cliente digitar um feedback.
        - Quando o cliente enviar, OBRIGATORIAMENTE faça um fetch usando a API REST do Firebase para enviar essa mensagem para o Thiago em tempo real.
        - URL EXATA DO FETCH: https://thiaguinho-40a14-default-rtdb.firebaseio.com/projetos_capturados/${idProjetoAtivo}/feedbacks.json
        - Exemplo do código do fetch que você deve gerar no HTML do cliente:
          fetch('https://thiaguinho-40a14-default-rtdb.firebaseio.com/projetos_capturados/${idProjetoAtivo}/feedbacks.json', { method: 'POST', body: JSON.stringify({ texto: mensagem_do_cliente, data: new Date().toISOString() }) })
        - Após o fetch, dê um alert amigável ("Mensagem enviada para a thIAguinho Soluções!") e limpe o formulário.

        Comece sua resposta avisando o Thiago que o código está pronto e que o botão de Feedback do Firebase foi integrado com sucesso.`;

        const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const contents = historicoSalvo.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
        contents.push({ role: 'user', parts: [{ text: msgAdmin }] });

        const res = await fetch(MODEL_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: contents, systemInstruction: { parts: [{ text: promptDesenvolvedor }] } })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro de processamento da IA.";

    } catch(e) {
        return "Erro de compilação da IA: " + e.message;
    }
}