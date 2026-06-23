import PDFParser from 'pdf2json';

export async function parseInvoicePdfLocally(buffer: Buffer): Promise<any> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, true);
    
    pdfParser.on("pdfParser_dataError", (errData: any) => {
      console.error(errData.parserError);
      reject(new Error("Failed to parse PDF"));
    });

    pdfParser.on("pdfParser_dataReady", async () => {
      try {
        const text = pdfParser.getRawTextContent();
        
        // 1. If OpenRouter key is available, use it to intelligently parse the extracted text
        if (process.env.OPENROUTER_API_KEY) {
          try {
            const makeOpenRouterRequest = async (modelName: string) => {
              return await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": "https://bizflow.app",
                  "X-Title": "BizFlow"
                },
                body: JSON.stringify({
                  model: modelName,
                  messages: [
                    {
                      role: "system",
                      content: "You are an AI that extracts invoice details. You must respond ONLY with valid JSON. Do not include markdown blocks like ```json."
                    },
                    {
                      role: "user",
                      content: `Extract the invoice details from the following raw PDF text. 
Return a JSON object with this exact structure:
{
  "invoiceNumber": "string",
  "purchaseDate": "YYYY-MM-DD",
  "supplier": "string",
  "products": [
    {
      "name": "string",
      "sku": "string or empty",
      "purchasePrice": number,
      "quantity": number,
      "gstRate": number,
      "hsnCode": "string or empty"
    }
  ]
}

Raw text:
${text}`
                    }
                  ]
                })
              });
            };

            let response = await makeOpenRouterRequest("nousresearch/hermes-3-llama-3.1-405b:free");
            
            if (!response.ok && response.status === 429) {
              console.warn("Hermes is rate limited, trying Llama 3.3 70B...");
              response = await makeOpenRouterRequest("meta-llama/llama-3.3-70b-instruct:free");
            }

            if (response.ok) {
              const data = await response.json();
              let content = data.choices[0].message.content || "";
              
              // Extract just the JSON object to avoid prefix/suffix text
              const firstBrace = content.indexOf('{');
              const lastBrace = content.lastIndexOf('}');
              
              if (firstBrace === -1 || lastBrace === -1) {
                throw new Error(`Model returned no JSON: ${content}`);
              }

              let cleanJson = content.substring(firstBrace, lastBrace + 1);
              const parsed = JSON.parse(cleanJson);
              
              return resolve(parsed);
            } else {
              console.warn("OpenRouter API failed, falling back to Regex:", await response.text());
            }
          } catch (llmErr) {
            console.warn("LLM Parsing failed, falling back to Regex:", llmErr);
            // DO NOT reject here. We let execution continue to the regex fallback below.
          }
        }

        // 2. Fallback to Basic regex patterns
        const invoiceNumberMatch = text.match(/Invoice\s*(?:No|#|Number)?\s*[:\-]?\s*([A-Z0-9\-]+)/i) || 
                                   text.match(/(?:INV|Invoice)[\s\-]?(\d{3,})/i);
        
        const dateMatch = text.match(/Date\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i);
        
        const supplierMatch = text.match(/(?:From|Supplier|Vendor)\s*[:\-]?\s*([^\n]+)/i);

        const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
        const guessedSupplier = supplierMatch ? supplierMatch[1].trim() : (lines[0] || "Unknown Supplier");

        const products: any[] = [];
        const productLineRegex = /^(.+?)\s+(\d+)\s+(?:EA|PCS|BOX)?\s*\$?\s*([\d,\.]+)\s*\$?\s*([\d,\.]+)$/i;
        
        for (const line of lines) {
          const match = line.match(productLineRegex);
          if (match) {
            const quantity = parseInt(match[2], 10);
            const price = parseFloat(match[3].replace(/,/g, ''));
            if (!isNaN(quantity) && !isNaN(price)) {
              products.push({
                name: match[1].trim(),
                category: "Uncategorized",
                purchasePrice: price,
                quantity: quantity,
                unit: "PCS"
              });
            }
          }
        }

        if (products.length === 0) {
          products.push({
            name: "Manual Entry Required (Regex Parser)",
            category: "Uncategorized",
            purchasePrice: 0,
            quantity: 1,
            unit: "PCS"
          });
        }

        resolve({
          invoiceNumber: invoiceNumberMatch ? invoiceNumberMatch[1].trim() : `INV-AUTO-${Date.now().toString().slice(-6)}`,
          supplier: guessedSupplier,
          purchaseDate: dateMatch ? dateMatch[1].trim() : new Date().toISOString().split('T')[0],
          products: products
        });
      } catch (err) {
        reject(err);
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}
