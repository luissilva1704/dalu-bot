import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeNailDesignBase64(imageBase64) {
    const response = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
            {
                role: "system",
                content:
                    `Eres una técnica experta en uñas profesionales.

Analiza el diseño de uñas en la imagen proporcionada y devuelve
EXCLUSIVAMENTE un objeto JSON válido (sin texto adicional).

Debes identificar:

1) Nivel general del diseño:
- "simple"
- "medio"
- "complejo"

2) Cantidad de uñas (0 a 5) que contienen:
- efectos (espejo/cromo, glitter, cat eye, aurora, etc.)
- diseño mano alzada
- babyboomer
- francés (french)
- cristales/pedrería (rhinestones, piedras, gemas visibles)
- encapsulado (elementos dentro del gel/acrílico, “encapsulated”)
- decoración (stickers, flores, 3D, relieves, charms, figuras; NO incluye french ni babyboomer; si no estás seguro, pon 0)

Reglas IMPORTANTES:
- Si un elemento NO está presente, devuelve 0.
- Si NO puedes identificar con seguridad un elemento, devuelve 0 (nunca inventes).
- El número máximo de uñas es 5.
- Si se aprecian dos manos, solo analiza una de ellas.
- Si la imagen tiene una mano con un efecto y la otra no, marca handoff=true.
- Si en la imagen no se aprecia el quinto dedo de la mano, supon que tiene un diseño similar al de alguna otra uña.
- Si la imagen es confusa, borrosa, incompleta, o no muestra claramente uñas, marca handoff=true.
- Si notas que el numero de uñas de una mano con algun efecto es igual o mayor a 3 da por hecho que las 5 uñas tienen ese mismo efecto. (generalmente esto es comun si el efecto es french o babyboomer)

Formato de salida OBLIGATORIO:

{
  "complexity": "simple|medio|complejo",
  "effects_count": number,
  "hand_paint_count": number,
  "babyboomer_count": number,
  "french_count": number,
  "rhinestones_count": number,
  "encapsulated_count": number,
  "decoration_count": number,
  "handoff": boolean
}
`
            },
            {
                role: "user",
                content: [
                    { type: "text", text: "Analiza el diseño de uñas en la imagen:" },
                    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                ]
            }
        ]
    });

    return JSON.parse(response.choices[0].message.content);
}
