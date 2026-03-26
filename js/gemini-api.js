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
// CÉREBRO 2: O ENGENHEIRO SAAS (INJETOR DA VOZ NEURAL DO GEMINI)
// =========================================================================
export async function conversarComDesenvolvedorIA(msgAdmin, contextoProjeto, historicoSalvo = [], idProjetoAtivo = "padrao") {
    try {
        const apiKey = await obterChaveDaApi();
        if (!apiKey) return "Configure a chave da API no Painel primeiro.";

        const promptDesenvolvedor = `Você é um Engenheiro de Software Sênior construindo sistemas para a thIAguinho Soluções.
        Projeto atual: ${contextoProjeto}
        ID ÚNICO do Cliente: ${idProjetoAtivo}
        
        Sempre coloque os códigos gerados em blocos Markdown puros (ex: \`\`\`html).

        DIRETRIZ MÁXIMA PARA O MOTOR DE VOZ DO MASCOTE:
        O Thiago baniu a API da ElevenLabs. Agora nós usamos o nosso próprio motor (Gemini TTS) dentro do código do cliente.
        Sempre que for criar um sistema com Chatbot/Mascote de voz, você é OBRIGADO a colocar exatamente a seguinte função JavaScript no código do cliente para processar a voz (Esta função puxa as chaves do Firebase do Thiago em tempo real e toca a voz nativa do Gemini com Web Audio API):

        \`\`\`javascript
        async function falarComMascote(textoParaFalar) {
            try {
                // 1. Busca a chave e o nome da voz dinamicamente no banco de dados do painel do Thiago
                const resKey = await fetch('https://thiaguinho-40a14-default-rtdb.firebaseio.com/admin_config/gemini_api_key.json');
                const adminApiKey = await resKey.json();
                const resVoice = await fetch('https://thiaguinho-40a14-default-rtdb.firebaseio.com/admin_config/gemini_voice_name.json');
                const voiceName = await resVoice.json() || "Aoede";

                if (!adminApiKey) throw new Error("Chave do Admin não encontrada.");

                // 2. Chama a API do Gemini TTS em modo de Áudio
                const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + adminApiKey;
                const payload = {
                    contents: [{ parts: [{ text: textoParaFalar }] }],
                    generationConfig: {
                        responseModalities: ["AUDIO"],
                        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } }
                    }
                };

                const res = await fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
                const data = await res.json();
                const base64Audio = data.candidates[0].content.parts[0].inlineData.data;

                // 3. Converte os bytes puros do Gemini (PCM16) para som de altíssima qualidade (Web Audio API)
                const binaryString = window.atob(base64Audio);
                const buffer = new ArrayBuffer(binaryString.length);
                const view = new Uint8Array(buffer);
                for (let i = 0; i < binaryString.length; i++) {
                    view[i] = binaryString.charCodeAt(i);
                }
                const int16View = new Int16Array(buffer);
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const audioBuffer = audioCtx.createBuffer(1, int16View.length, 24000); // 24kHz do Gemini
                const channelData = audioBuffer.getChannelData(0);
                for (let i = 0; i < int16View.length; i++) {
                    channelData[i] = int16View[i] / 32768.0;
                }
                const source = audioCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioCtx.destination);
                source.start();

            } catch(e) {
                console.warn("Falha no Motor Gemini, ativando plano B local: ", e);
                const fallback = new SpeechSynthesisUtterance(textoParaFalar);
                fallback.lang = 'pt-BR';
                window.speechSynthesis.speak(fallback);
            }
        }
        \`\`\`

        A ÚNICA OUTRA COISA OBRIGATÓRIA É O CHAT REVERSO (FEEDBACK DIRETO PARA O THIAGO):
        - Adicione um botão flutuante e chamativo no HTML gerado (ex: "Gostou do sistema? Fale com o Thiago").
        - URL EXATA DO FETCH: https://thiaguinho-40a14-default-rtdb.firebaseio.com/projetos_capturados/${idProjetoAtivo}/feedbacks.json
        - Exemplo: fetch('https://thiaguinho-40a14-default-rtdb.firebaseio.com/projetos_capturados/${idProjetoAtivo}/feedbacks.json', { method: 'POST', body: JSON.stringify({ texto: msg, data: new Date().toISOString() }) })

        Comece sua resposta avisando o Thiago que o código está pronto e que o motor de Voz Neural do Gemini foi injetado com sucesso.`;

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