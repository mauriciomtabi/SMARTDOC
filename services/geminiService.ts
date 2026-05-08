

import { GoogleGenAI, Type } from "@google/genai";
import { DocCategory } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to convert blob to base64
export const fileToGenerativePart = async (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64," or "data:application/pdf;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// --- NOTES PROCESSING ---

export const processNoteAudio = async (audioBlob: Blob, mimeType: string = 'audio/webm') => {
  try {
    const base64Data = await fileToGenerativePart(audioBlob);

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: `
              Você é um assistente pessoal inteligente.
              O usuário gravou uma anotação de voz.
              
              Sua tarefa:
              1. Transcreva e resuma o conteúdo principal.
              2. Crie um Título curto e atraente baseado no conteúdo.
              3. Formate o conteúdo em HTML limpo. Use tags como <h3>, <p>, <ul>, <li>, <strong>, <em>. NÃO use Markdown.
              
              Responda APENAS com o JSON.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Título curto da anotação" },
            content: { type: Type.STRING, description: "Conteúdo formatado em HTML" },
            tags: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Tags sugeridas (ex: #trabalho, #ideia)"
            }
          },
          required: ["title", "content"]
        }
      }
    });

    if (!response.text) throw new Error("No response from AI");
    return JSON.parse(response.text);

  } catch (error) {
    console.error("Gemini Note Audio Error:", error);
    throw error;
  }
};

export const processNoteImage = async (base64Image: string, mimeType: string = 'image/jpeg') => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          },
          {
            text: `
              Analise esta imagem (pode ser texto manuscrito, quadro branco ou documento impresso).
              
              Sua tarefa:
              1. Transcreva todo o texto legível.
              2. Se for anotação de reunião ou aula, organize em tópicos.
              3. Crie um Título curto.
              4. Formate o conteúdo em HTML limpo. Use tags como <h3>, <p>, <ul>, <li>, <strong>, <em>. NÃO use Markdown.
              
              Responda APENAS com o JSON.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Título curto da anotação" },
            content: { type: Type.STRING, description: "Texto extraído e formatado em HTML" },
            tags: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }
            }
          },
          required: ["title", "content"]
        }
      }
    });

    if (!response.text) throw new Error("No response from AI");
    return JSON.parse(response.text);

  } catch (error) {
    console.error("Gemini Note Image Error:", error);
    throw error;
  }
};

// --- AUDIO PROCESSING FOR FINANCE ---
export const processFinanceAudio = async (audioBlob: Blob, mimeType: string = 'audio/webm') => {
  try {
    const base64Data = await fileToGenerativePart(audioBlob);

    // Using gemini-3-flash-preview as the standard multimodal model.
    // Ensure the mimeType passed matches the recording.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: `
              Você é um assistente financeiro pessoal altamente preciso.
              Sua tarefa é transcrever e extrair os dados financeiros do áudio com EXTREMA FIDELIDADE ao que foi dito.
              NÃO INVENTE, NÃO DEDUZA e NÃO SUBSTITUA palavras por sinônimos se o usuário foi explícito.
              
              Regras rigorosas de extração:
              1. TIPO (Receita/Despesa): Se o usuário falar "gastei", "comprei", "paguei", "despesa", é 'expense'. Se falar "recebi", "ganhei", "entrou", "salário", é 'income'.
              2. VALOR: Extraia o valor numérico exato.
              3. DATA: Se mencionado "hoje", "ontem", ou uma data específica, calcule/extraia a data correspondente (formato YYYY-MM-DD). Se não mencionado, use a data de hoje.
              4. STATUS: Se o usuário disser que "já pagou", "foi pago", "comprei" (passado), o status é 'paid'. Se disser "vou pagar", "vence dia", "pendente", é 'pending'.
              5. DESCRIÇÃO: Crie uma descrição curta e direta baseada no que foi dito.
              6. CATEGORIA: Sugira uma categoria (ex: Alimentação, Transporte, Moradia, Lazer, Saúde, Educação, etc).
              7. FORMA DE PAGAMENTO (CRÍTICO): 
                 - Mapeie EXATAMENTE o que o usuário disse.
                 - Se ele disser "débito" ou "cartão de débito", retorne "Cartão de Débito". NÃO retorne Pix ou Crédito.
                 - Se ele disser "crédito" ou "cartão de crédito", retorne "Cartão de Crédito".
                 - Se ele disser "pix", retorne "Pix".
                 - Se ele disser "dinheiro" ou "espécie", retorne "Dinheiro".
                 - Se ele disser "boleto", retorne "Boleto".
                 - Se ele disser "transferência" ou "TED", retorne "Transferência".
                 - Se a forma de pagamento NÃO for mencionada no áudio, retorne "Outros". NUNCA adivinhe a forma de pagamento.

              Responda APENAS com o JSON.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: "Descrição curta da transação" },
            amount: { type: Type.NUMBER, description: "Valor numérico (ex: 50.50)" },
            type: { type: Type.STRING, enum: ['income', 'expense'] },
            status: { type: Type.STRING, enum: ['paid', 'pending', 'unknown'] },
            date: { type: Type.STRING, description: "YYYY-MM-DD" },
            category: { type: Type.STRING },
            paymentMethod: { type: Type.STRING, description: "Ex: Pix, Cartão de Crédito, Cartão de Débito, Boleto, Dinheiro, Transferência, Outros. DEVE ser exato ao que foi falado." }
          },
          required: ["description", "amount", "type", "status", "category"]
        }
      }
    });

    if (!response.text) {
      throw new Error("No response from AI");
    }

    return JSON.parse(response.text);

  } catch (error) {
    console.error("Gemini Finance Audio Error:", error);
    throw error;
  }
};

export const analyzeDocument = async (base64Image: string, mimeType: string = 'image/jpeg', availableFolders: string[] = []) => {
  try {
    const foldersString = availableFolders.length > 0 ? availableFolders.join(', ') : "Geral";

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          },
          {
            text: `Analyze this file (document image or PDF). 
            Identify the document type (Nota Fiscal, Documento Pessoal, Contrato, Recibo, Médico, Outro).
            Extract a short title, the main date found, a brief summary, and key-value pairs of important specific data (like Valor Total, CPF, CNPJ, Emissor).
            
            CRITICAL: Based on the content, suggest the best folder to store this document from the following list: [${foldersString}]. 
            If none fit perfectly, choose the most generic one or 'Geral'.`
          }
        ]
      },
      config: {
        systemInstruction: "You are an expert document processor for a Brazilian document management system. Always respond in Portuguese.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Um título curto e descritivo para o documento" },
            category: { 
              type: Type.STRING, 
              enum: [
                DocCategory.INVOICE,
                DocCategory.PERSONAL,
                DocCategory.CONTRACT,
                DocCategory.RECEIPT,
                DocCategory.MEDICAL,
                DocCategory.MEETING,
                DocCategory.OTHER
              ] 
            },
            suggestedFolderName: { 
              type: Type.STRING, 
              description: `Must be exactly one of: ${foldersString}` 
            },
            date: { type: Type.STRING, description: "Data encontrada no formato YYYY-MM-DD" },
            summary: { type: Type.STRING, description: "Resumo de uma frase do conteúdo" },
            keyValues: {
              type: Type.OBJECT,
              description: "Campos extraídos com chaves em Português do Brasil (ex: 'Valor Total', 'Emissor', 'CPF/CNPJ')",
              properties: {
                // Definindo propriedades em Português para guiar o modelo
                "Valor Total": { type: Type.NUMBER, description: "Se houver valor monetário, o total" },
                "CPF/CNPJ": { type: Type.STRING, description: "CPF, RG ou CNPJ se presente" },
                "Emissor": { type: Type.STRING, description: "Empresa ou Pessoa que emitiu o documento" }
              }
            }
          },
          required: ["title", "category", "summary", "suggestedFolderName"]
        }
      }
    });

    if (!response.text) {
      throw new Error("No response from AI");
    }

    return JSON.parse(response.text);

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};